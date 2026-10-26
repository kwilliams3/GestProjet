import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { query } from '../db.js';
import { VISIBLE_PROJECT, assertActive, loadProject, visibilityParams } from '../lib/access.js';
import { HttpError, parseBody, parseId } from '../lib/http.js';
import { removeStoredFiles, storedFilePath } from '../lib/storage.js';
import { dateString, z } from '../lib/schemas.js';

export const projectModules = Router({ mergeParams: true });
export const projectDocuments = Router();
export const calendar = Router();
export const reports = Router();

const moduleSelects = {
  expenses: `SELECT e.id, e.project_id, e.title, e.amount, e.spent_on, e.created_by, e.created_at,
                    u.full_name AS created_by_name
             FROM project_expenses e LEFT JOIN users u ON u.id = e.created_by`,
  time: `SELECT te.id, te.project_id, te.task_id, te.user_id, te.description, te.minutes, te.worked_on,
                te.created_at, u.full_name AS user_name, t.title AS task_title
         FROM time_entries te
         LEFT JOIN users u ON u.id = te.user_id
         LEFT JOIN tasks t ON t.id = te.task_id`,
  documents: `SELECT d.id, d.project_id, d.original_name, d.mime_type, d.size_bytes, d.created_at,
                     d.uploaded_by, u.full_name AS uploaded_by_name
              FROM project_documents d LEFT JOIN users u ON u.id = d.uploaded_by`,
};

const validDate = dateString.refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Date invalide');

function requireManager(canManage) {
  if (!canManage) throw new HttpError(403, 'Seul un responsable du projet peut gérer cette rubrique');
}

const expenseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  amount: z.number().positive().multipleOf(0.01).max(999999999999.99),
  spent_on: validDate,
});

const timeEntrySchema = z.object({
  task_id: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(500).default(''),
  minutes: z.number().int().min(1).max(1440),
  worked_on: validDate,
});

projectModules.get('/expenses', async (req, res) => {
  const { project } = await loadProject(parseId(req.params.projectId), req.user);
  const { rows } = await query(`${moduleSelects.expenses} WHERE e.project_id = $1 ORDER BY e.spent_on DESC, e.id DESC`, [
    project.id,
  ]);
  res.json(rows);
});

projectModules.post('/expenses', async (req, res) => {
  const { project, canManage } = await loadProject(parseId(req.params.projectId), req.user);
  requireManager(canManage);
  assertActive(project);
  const data = parseBody(expenseSchema, req.body);
  const { rows } = await query(
    `INSERT INTO project_expenses (project_id, title, amount, spent_on, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [project.id, data.title, data.amount, data.spent_on, req.user.id],
  );
  const { rows: created } = await query(`${moduleSelects.expenses} WHERE e.id = $1`, [rows[0].id]);
  res.status(201).json(created[0]);
});

projectModules.delete('/expenses/:expenseId', async (req, res) => {
  const { project, canManage } = await loadProject(parseId(req.params.projectId), req.user);
  requireManager(canManage);
  assertActive(project);
  const expenseId = parseId(req.params.expenseId);
  const { rowCount } = await query('DELETE FROM project_expenses WHERE id = $1 AND project_id = $2', [
    expenseId,
    project.id,
  ]);
  if (!rowCount) throw new HttpError(404, 'Dépense introuvable');
  res.status(204).end();
});

projectModules.get('/time-entries', async (req, res) => {
  const { project } = await loadProject(parseId(req.params.projectId), req.user);
  const { rows } = await query(`${moduleSelects.time} WHERE te.project_id = $1 ORDER BY te.worked_on DESC, te.id DESC`, [
    project.id,
  ]);
  res.json(rows);
});

projectModules.post('/time-entries', async (req, res) => {
  const { project } = await loadProject(parseId(req.params.projectId), req.user);
  assertActive(project);
  if (req.user.role === 'invite') throw new HttpError(403, 'Les invités ne peuvent pas enregistrer de temps');
  const data = parseBody(timeEntrySchema, req.body);
  if (data.task_id) {
    const { rows } = await query('SELECT id FROM tasks WHERE id = $1 AND project_id = $2', [data.task_id, project.id]);
    if (!rows[0]) throw new HttpError(400, 'La tâche sélectionnée ne fait pas partie de ce projet');
  }
  const { rows } = await query(
    `INSERT INTO time_entries (project_id, task_id, user_id, description, minutes, worked_on)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [project.id, data.task_id ?? null, req.user.id, data.description, data.minutes, data.worked_on],
  );
  const { rows: created } = await query(`${moduleSelects.time} WHERE te.id = $1`, [rows[0].id]);
  res.status(201).json(created[0]);
});

projectModules.delete('/time-entries/:entryId', async (req, res) => {
  const { project, canManage } = await loadProject(parseId(req.params.projectId), req.user);
  assertActive(project);
  const entryId = parseId(req.params.entryId);
  const { rows } = await query('SELECT user_id FROM time_entries WHERE id = $1 AND project_id = $2', [
    entryId,
    project.id,
  ]);
  const entry = rows[0];
  if (!entry) throw new HttpError(404, 'Saisie de temps introuvable');
  if (!canManage && entry.user_id !== req.user.id) {
    throw new HttpError(403, 'Vous ne pouvez supprimer que vos propres saisies de temps');
  }
  await query('DELETE FROM time_entries WHERE id = $1', [entryId]);
  res.status(204).end();
});

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

async function checkCanUploadDocument(req, res, next) {
  const { project, canManage } = await loadProject(parseId(req.params.projectId), req.user);
  if (!canManage && req.user.role !== 'membre') {
    throw new HttpError(403, 'Seuls les membres du projet peuvent ajouter des documents');
  }
  assertActive(project);
  req.project = project;
  next();
}

projectModules.get('/documents', async (req, res) => {
  const { project } = await loadProject(parseId(req.params.projectId), req.user);
  const { rows } = await query(
    `${moduleSelects.documents} WHERE d.project_id = $1 ORDER BY d.created_at DESC, d.id DESC`,
    [project.id],
  );
  res.json(rows);
});

projectModules.post('/documents', checkCanUploadDocument, upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucun fichier reçu (champ « file » attendu)');
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 255);
  try {
    const { rows } = await query(
      `INSERT INTO project_documents (project_id, uploaded_by, original_name, storage_key, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.project.id, req.user.id, originalName, req.file.filename, req.file.mimetype || 'application/octet-stream', req.file.size],
    );
    const { rows: created } = await query(`${moduleSelects.documents} WHERE d.id = $1`, [rows[0].id]);
    res.status(201).json(created[0]);
  } catch (err) {
    await removeStoredFiles([req.file.filename]);
    throw err;
  }
});

async function loadProjectDocument(id, user) {
  const { rows } = await query('SELECT * FROM project_documents WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Document introuvable');
  const { project, canManage } = await loadProject(rows[0].project_id, user);
  return { document: rows[0], project, canManage };
}

projectDocuments.get('/:id/download', async (req, res) => {
  const { document } = await loadProjectDocument(parseId(req.params.id), req.user);
  const filePath = storedFilePath(document.storage_key);
  try {
    await access(filePath);
  } catch {
    throw new HttpError(404, 'Fichier introuvable sur le serveur');
  }
  res.download(filePath, document.original_name);
});

projectDocuments.delete('/:id', async (req, res) => {
  const { document, project, canManage } = await loadProjectDocument(parseId(req.params.id), req.user);
  if (!canManage && document.uploaded_by !== req.user.id) {
    throw new HttpError(403, 'Vous ne pouvez supprimer que les documents que vous avez ajoutés');
  }
  assertActive(project);
  await query('DELETE FROM project_documents WHERE id = $1', [document.id]);
  await removeStoredFiles([document.storage_key]);
  res.status(204).end();
});

calendar.get('/', async (req, res) => {
  const querySchema = z.object({ from: validDate, to: validDate });
  const { from, to } = parseBody(querySchema, req.query);
  if (to < from) throw new HttpError(400, 'La date de fin doit être postérieure à la date de début');
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 62) {
    throw new HttpError(400, 'La période du calendrier ne peut pas dépasser 63 jours');
  }
  const { rows } = await query(
    `WITH visible_projects AS (
       SELECT p.id, p.name, p.start_date, p.end_date
       FROM projects p
       WHERE ${VISIBLE_PROJECT} AND p.status = 'actif' AND NOT p.is_template
     )
     SELECT 'task'::text AS event_type, t.id, t.project_id, t.due_date AS event_date, t.title,
            p.name AS project_name, t.status::text AS status, t.priority::text AS priority
     FROM tasks t JOIN visible_projects p ON p.id = t.project_id
     WHERE t.due_date BETWEEN $4 AND $5
     UNION ALL
     SELECT 'project_start', p.id, p.id, p.start_date, 'Début du projet', p.name, NULL::text, NULL::text
     FROM visible_projects p
     WHERE p.start_date BETWEEN $4 AND $5
     UNION ALL
     SELECT 'project_end', p.id, p.id, p.end_date, 'Fin prévue du projet', p.name, NULL::text, NULL::text
     FROM visible_projects p
     WHERE p.end_date BETWEEN $4 AND $5
     ORDER BY event_date, project_name, event_type, id`,
    [...visibilityParams(req.user), from, to],
  );
  res.json(rows);
});

reports.get('/', async (req, res) => {
  const { rows: projects } = await query(
    `SELECT p.id, p.name, p.status, p.end_date, p.budget,
            COUNT(DISTINCT t.id) AS task_count,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'termine') AS done_count,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'en_cours') AS in_progress_count,
            COUNT(DISTINCT t.id) FILTER (WHERE t.status <> 'termine' AND t.due_date < current_date) AS overdue_count,
            COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id), 0) AS spent,
            COALESCE((SELECT SUM(te.minutes) FROM time_entries te WHERE te.project_id = p.id), 0) AS minutes_logged
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE ${VISIBLE_PROJECT} AND NOT p.is_template
     GROUP BY p.id
     ORDER BY p.status, p.end_date NULLS LAST, p.name`,
    visibilityParams(req.user),
  );
  const totals = projects.reduce(
    (result, project) => {
      result.projects += project.status === 'actif' ? 1 : 0;
      result.tasks += project.task_count;
      result.done += project.done_count;
      result.in_progress += project.in_progress_count;
      result.overdue += project.overdue_count;
      result.spent += project.spent;
      result.minutes_logged += project.minutes_logged;
      return result;
    },
    { projects: 0, tasks: 0, done: 0, in_progress: 0, overdue: 0, spent: 0, minutes_logged: 0 },
  );
  res.json({ totals, projects });
});
