import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { query } from '../db.js';
import { assertActive, canEditTask } from '../lib/access.js';
import { HttpError, parseId } from '../lib/http.js';
import { removeStoredFiles, storedFilePath } from '../lib/storage.js';
import { loadTask } from '../lib/tasks.js';

// F11 : pièces jointes d'une tâche (50 Mo maximum par fichier).
// Ajout réservé aux personnes qui peuvent modifier la tâche ; téléchargement ouvert à tous ceux qui la voient.

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const taskAttachments = Router({ mergeParams: true }); // /api/tasks/:taskId/attachments
export const attachments = Router(); // /api/attachments

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

const ATTACHMENT_SELECT = `
  SELECT a.id, a.task_id, a.original_name, a.mime_type, a.size_bytes, a.created_at,
         a.uploaded_by, u.full_name AS uploaded_by_name
  FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by`;

async function loadAttachment(id, user) {
  const { rows } = await query('SELECT * FROM attachments WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Pièce jointe introuvable');
  return { attachment: rows[0], ...(await loadTask(rows[0].task_id, user)) };
}

// Les droits sont vérifiés avant de recevoir le fichier, pour ne pas écrire 50 Mo inutilement.
async function checkCanUpload(req, res, next) {
  const { task, project, canManage } = await loadTask(parseId(req.params.taskId), req.user);
  if (!canEditTask(req.user, task, canManage)) {
    throw new HttpError(403, 'Seules les personnes qui peuvent modifier la tâche peuvent y joindre des fichiers');
  }
  assertActive(project);
  req.task = task;
  next();
}

taskAttachments.get('/', async (req, res) => {
  const { task } = await loadTask(parseId(req.params.taskId), req.user);
  const { rows } = await query(`${ATTACHMENT_SELECT} WHERE a.task_id = $1 ORDER BY a.created_at`, [task.id]);
  res.json(rows);
});

taskAttachments.post('/', checkCanUpload, upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucun fichier reçu (champ « file » attendu)');
  // multer lit le nom en latin-1 alors que les navigateurs l'envoient en UTF-8 (« été » deviendrait « Ã©tÃ© »).
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  try {
    const { rows } = await query(
      `INSERT INTO attachments (task_id, uploaded_by, original_name, storage_key, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        req.task.id,
        req.user.id,
        originalName.slice(0, 255),
        req.file.filename,
        req.file.mimetype || 'application/octet-stream',
        req.file.size,
      ],
    );
    const { rows: created } = await query(`${ATTACHMENT_SELECT} WHERE a.id = $1`, [rows[0].id]);
    res.status(201).json(created[0]);
  } catch (err) {
    await removeStoredFiles([req.file.filename]);
    throw err;
  }
});

attachments.get('/:id/download', async (req, res) => {
  const { attachment } = await loadAttachment(parseId(req.params.id), req.user);
  const filePath = storedFilePath(attachment.storage_key);
  try {
    await access(filePath);
  } catch {
    throw new HttpError(404, 'Fichier introuvable sur le serveur');
  }
  res.download(filePath, attachment.original_name);
});

attachments.delete('/:id', async (req, res) => {
  const { attachment, project, canManage } = await loadAttachment(parseId(req.params.id), req.user);
  if (attachment.uploaded_by !== req.user.id && !canManage) {
    throw new HttpError(403, 'Vous ne pouvez supprimer que les fichiers que vous avez ajoutés');
  }
  assertActive(project);
  await query('DELETE FROM attachments WHERE id = $1', [attachment.id]);
  await removeStoredFiles([attachment.storage_key]);
  res.status(204).end();
});
