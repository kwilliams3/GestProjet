import { Router } from 'express';
import { query, updateRow, withTransaction } from '../db.js';
import { assertActive, canEditTask } from '../lib/access.js';
import { HttpError, parseBody, parseId, pick } from '../lib/http.js';
import { notifyAssigned } from '../lib/notifications.js';
import { taskUpdateSchema } from '../lib/schemas.js';
import { removeStoredFiles } from '../lib/storage.js';
import { ASSIGNEES_JOIN, TASK_COLUMNS, assertAssignable, fetchTask, loadTask, setAssignees } from '../lib/tasks.js';

const router = Router();

// « Mes tâches » : tâches assignées à l'utilisateur dans les projets actifs.
router.get('/mine', async (req, res) => {
  const { rows } = await query(
    `SELECT ${TASK_COLUMNS}, p.name AS project_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     ${ASSIGNEES_JOIN}
     WHERE p.status = 'actif'
       AND EXISTS (SELECT 1 FROM task_assignees x WHERE x.task_id = t.id AND x.user_id = $1)
     GROUP BY t.id, p.name
     ORDER BY (t.status = 'termine'), t.due_date NULLS LAST, t.priority DESC`,
    [req.user.id],
  );
  res.json(rows);
});

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { task, project, canManage } = await loadTask(id, req.user);
  if (!canEditTask(req.user, task, canManage)) {
    throw new HttpError(403, 'Vous ne pouvez modifier que les tâches qui vous sont assignées');
  }
  assertActive(project);

  const data = parseBody(taskUpdateSchema, req.body);
  if (data.assignee_ids && !canManage) {
    throw new HttpError(403, "Seul un chef de projet peut changer l'assignation");
  }

  await withTransaction(async (db) => {
    const values = pick(data, ['title', 'description', 'status', 'priority', 'due_date', 'labels', 'position']);
    if (data.status && data.status !== task.status) {
      values.completed_at = data.status === 'termine' ? new Date() : null;
    }
    await updateRow(db, 'tasks', id, values);
    if (data.assignee_ids) {
      await assertAssignable(db, task.project_id, data.assignee_ids);
      const added = await setAssignees(db, id, data.assignee_ids);
      await notifyAssigned(db, added, id, data.title ?? task.title, req.user);
    }
  });

  res.json(await fetchTask(id));
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { project, canManage } = await loadTask(id, req.user);
  if (!canManage) throw new HttpError(403, 'Seul un chef de projet peut supprimer une tâche');
  assertActive(project);

  // Les fichiers joints à la tâche et à ses sous-tâches sont supprimés du disque après la base.
  const { rows: files } = await query(
    `SELECT a.storage_key FROM attachments a JOIN tasks t ON t.id = a.task_id
     WHERE t.id = $1 OR t.parent_id = $1`,
    [id],
  );
  await query('DELETE FROM tasks WHERE id = $1', [id]);
  await removeStoredFiles(files.map((file) => file.storage_key));
  res.status(204).end();
});

export default router;
