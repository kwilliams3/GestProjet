import { pool } from '../db.js';
import { loadProject } from './access.js';
import { HttpError } from './http.js';

// Colonnes renvoyées pour une tâche : ses champs, ses compteurs et la liste de ses assignés
// (à utiliser avec ASSIGNEES_JOIN et GROUP BY t.id).
export const TASK_COLUMNS = `
  t.*,
  (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
  (SELECT COUNT(*) FROM attachments a WHERE a.task_id = t.id) AS attachment_count,
  COALESCE(
    json_agg(json_build_object('id', u.id, 'full_name', u.full_name) ORDER BY u.full_name)
      FILTER (WHERE u.id IS NOT NULL),
    '[]'
  ) AS assignees`;

export const ASSIGNEES_JOIN = `
  LEFT JOIN task_assignees ta ON ta.task_id = t.id
  LEFT JOIN users u ON u.id = ta.user_id`;

export async function fetchTask(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${TASK_COLUMNS} FROM tasks t ${ASSIGNEES_JOIN} WHERE t.id = $1 GROUP BY t.id`,
    [id],
  );
  return rows[0] ?? null;
}

/** Charge une tâche et son projet, en vérifiant que l'utilisateur y a accès. */
export async function loadTask(id, user) {
  const task = await fetchTask(id);
  if (!task) throw new HttpError(404, 'Tâche introuvable');
  const { project, canManage } = await loadProject(task.project_id, user);
  return { task, project, canManage };
}

/** Vérifie que toutes les personnes à assigner sont membres du projet (hors invités). */
export async function assertAssignable(db, projectId, userIds) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  const { rows } = await db.query(
    `SELECT m.user_id FROM project_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.project_id = $1 AND m.user_id = ANY($2::int[]) AND u.role <> 'invite'`,
    [projectId, uniqueIds],
  );
  if (rows.length !== uniqueIds.length) {
    throw new HttpError(400, 'Seuls les membres du projet (hors invités) peuvent être assignés');
  }
}

/** Remplace les assignés d'une tâche et renvoie les personnes nouvellement assignées. */
export async function setAssignees(db, taskId, userIds) {
  const ids = [...new Set(userIds)];
  const { rows } = await db.query('DELETE FROM task_assignees WHERE task_id = $1 RETURNING user_id', [taskId]);
  if (ids.length > 0) {
    await db.query('INSERT INTO task_assignees (task_id, user_id) SELECT $1, unnest($2::int[])', [taskId, ids]);
  }
  const previous = new Set(rows.map((row) => row.user_id));
  return ids.filter((id) => !previous.has(id));
}
