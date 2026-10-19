import { Router } from 'express';
import { query, updateRow, withTransaction } from '../db.js';
import { VISIBLE_PROJECT, assertActive, loadProject, visibilityParams } from '../lib/access.js';
import { HttpError, parseBody, parseId, pick } from '../lib/http.js';
import { notifyAssigned } from '../lib/notifications.js';
import { projectCreateSchema, projectUpdateSchema, taskCreateSchema, z } from '../lib/schemas.js';
import { ASSIGNEES_JOIN, TASK_COLUMNS, assertAssignable, fetchTask, setAssignees } from '../lib/tasks.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const forbidden = () => new HttpError(403, "Seul un chef de projet membre du projet peut faire cette action");

function assertDates(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new HttpError(400, 'La date de fin doit être postérieure à la date de début');
  }
}

/** Le propriétaire reste toujours membre ; les assignations des membres retirés sont supprimées. */
async function setMembers(db, projectId, ownerId, memberIds) {
  const ids = [...new Set([ownerId, ...memberIds])];
  await db.query('DELETE FROM project_members WHERE project_id = $1 AND user_id <> ALL($2::int[])', [projectId, ids]);
  await db.query(
    `INSERT INTO project_members (project_id, user_id)
     SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
    [projectId, ids],
  );
  await db.query(
    `DELETE FROM task_assignees ta USING tasks t
     WHERE ta.task_id = t.id AND t.project_id = $1 AND ta.user_id <> ALL($2::int[])`,
    [projectId, ids],
  );
}

async function projectDetails(projectId, user) {
  const { project, canManage } = await loadProject(projectId, user);
  const { rows: members } = await query(
    `SELECT u.id, u.full_name, u.email, u.role
     FROM project_members m JOIN users u ON u.id = m.user_id
     WHERE m.project_id = $1
     ORDER BY u.full_name`,
    [projectId],
  );
  return { ...project, members, can_manage: canManage };
}

router.get('/', async (req, res) => {
  const status = req.query.status === 'archive' ? 'archive' : 'actif';
  const { rows } = await query(
    `SELECT p.id, p.name, p.description, p.start_date, p.end_date, p.status, p.is_template, p.budget,
            u.full_name AS owner_name,
            COUNT(t.id) AS task_count,
            COUNT(t.id) FILTER (WHERE t.status = 'termine') AS done_count,
            COUNT(t.id) FILTER (WHERE t.status <> 'termine' AND t.due_date < current_date) AS overdue_count
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE ${VISIBLE_PROJECT} AND p.status = $4
     GROUP BY p.id, u.full_name
     ORDER BY p.is_template, p.created_at DESC`,
    [...visibilityParams(req.user), status],
  );
  res.json(rows);
});

router.post('/', requireRole('admin', 'chef_projet'), async (req, res) => {
  const data = parseBody(projectCreateSchema, req.body);
  assertDates(data.start_date, data.end_date);

  const projectId = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO projects (name, description, objectives, start_date, end_date, budget, is_template, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.name,
        data.description ?? '',
        data.objectives ?? '',
        data.start_date ?? null,
        data.end_date ?? null,
        data.budget ?? null,
        data.is_template ?? false,
        req.user.id,
      ],
    );
    await setMembers(db, rows[0].id, req.user.id, data.member_ids ?? []);
    return rows[0].id;
  });

  res.status(201).json(await projectDetails(projectId, req.user));
});

router.get('/:id', async (req, res) => {
  res.json(await projectDetails(parseId(req.params.id), req.user));
});

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { project, canManage } = await loadProject(id, req.user);
  if (!canManage) throw forbidden();

  const data = parseBody(projectUpdateSchema, req.body);
  assertDates(
    data.start_date !== undefined ? data.start_date : project.start_date,
    data.end_date !== undefined ? data.end_date : project.end_date,
  );

  await withTransaction(async (db) => {
    const columns = ['name', 'description', 'objectives', 'start_date', 'end_date', 'budget', 'is_template', 'status'];
    await updateRow(db, 'projects', id, pick(data, columns));
    if (data.member_ids) await setMembers(db, id, project.owner_id, data.member_ids);
  });

  res.json(await projectDetails(id, req.user));
});

// F03 : crée un nouveau projet à partir d'un projet existant ou d'un modèle (tâches et sous-tâches copiées).
router.post('/:id/duplicate', requireRole('admin', 'chef_projet'), async (req, res) => {
  const sourceId = parseId(req.params.id);
  const { project: source } = await loadProject(sourceId, req.user);
  const { name } = parseBody(z.object({ name: z.string().trim().min(1).max(150).optional() }), req.body);

  const newId = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO projects (name, description, objectives, budget, owner_id)
       SELECT $2, description, objectives, budget, $3 FROM projects WHERE id = $1
       RETURNING id`,
      [sourceId, name ?? `${source.name} (copie)`, req.user.id],
    );
    const projectId = rows[0].id;
    await setMembers(db, projectId, req.user.id, []);

    // Les parents passent avant leurs sous-tâches : on garde la correspondance ancien id → nouvel id.
    const { rows: tasks } = await db.query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY parent_id NULLS FIRST, position',
      [sourceId],
    );
    const newIds = new Map();
    for (const task of tasks) {
      const { rows: inserted } = await db.query(
        `INSERT INTO tasks (project_id, parent_id, title, description, priority, labels, position, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          projectId,
          task.parent_id ? newIds.get(task.parent_id) : null,
          task.title,
          task.description,
          task.priority,
          task.labels,
          task.position,
          req.user.id,
        ],
      );
      newIds.set(task.id, inserted[0].id);
    }
    return projectId;
  });

  res.status(201).json(await projectDetails(newId, req.user));
});

router.get('/:id/tasks', async (req, res) => {
  const id = parseId(req.params.id);
  await loadProject(id, req.user);
  const { rows } = await query(
    `SELECT ${TASK_COLUMNS}
     FROM tasks t ${ASSIGNEES_JOIN}
     WHERE t.project_id = $1
     GROUP BY t.id
     ORDER BY t.position, t.id`,
    [id],
  );
  res.json(rows);
});

router.post('/:id/tasks', async (req, res) => {
  const projectId = parseId(req.params.id);
  const { project, canManage } = await loadProject(projectId, req.user);
  if (!canManage) throw forbidden();
  assertActive(project);
  const data = parseBody(taskCreateSchema, req.body);

  const taskId = await withTransaction(async (db) => {
    if (data.parent_id) {
      const { rows } = await db.query('SELECT project_id, parent_id FROM tasks WHERE id = $1', [data.parent_id]);
      const parent = rows[0];
      if (!parent || parent.project_id !== projectId) {
        throw new HttpError(400, 'Tâche parente introuvable dans ce projet');
      }
      if (parent.parent_id) throw new HttpError(400, 'Une sous-tâche ne peut pas avoir de sous-tâches');
    }
    const assigneeIds = data.assignee_ids ?? [];
    await assertAssignable(db, projectId, assigneeIds);

    const status = data.status ?? 'a_faire';
    const { rows } = await db.query(
      `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, due_date, labels,
                          position, created_by, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE project_id = $1), $9, $10)
       RETURNING id`,
      [
        projectId,
        data.parent_id ?? null,
        data.title,
        data.description ?? '',
        status,
        data.priority ?? 'moyenne',
        data.due_date ?? null,
        data.labels ?? [],
        req.user.id,
        status === 'termine' ? new Date() : null,
      ],
    );
    const added = await setAssignees(db, rows[0].id, assigneeIds);
    await notifyAssigned(db, added, rows[0].id, data.title, req.user);
    return rows[0].id;
  });

  res.status(201).json(await fetchTask(taskId));
});

export default router;
