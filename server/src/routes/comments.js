import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { assertActive } from '../lib/access.js';
import { HttpError, parseBody, parseId } from '../lib/http.js';
import { findMentions, notify } from '../lib/notifications.js';
import { z } from '../lib/schemas.js';
import { loadTask } from '../lib/tasks.js';

// F11 : commentaires d'une tâche, avec mentions « @Prénom Nom ».
// Toute personne ayant accès au projet peut commenter (invités compris).

export const taskComments = Router({ mergeParams: true }); // /api/tasks/:taskId/comments
export const comments = Router(); // /api/comments

const COMMENT_SELECT = `
  SELECT c.id, c.task_id, c.body, c.created_at, c.author_id, u.full_name AS author_name
  FROM comments c LEFT JOIN users u ON u.id = c.author_id`;

const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

taskComments.get('/', async (req, res) => {
  const { task } = await loadTask(parseId(req.params.taskId), req.user);
  const { rows } = await query(`${COMMENT_SELECT} WHERE c.task_id = $1 ORDER BY c.created_at, c.id`, [task.id]);
  res.json(rows);
});

taskComments.post('/', async (req, res) => {
  const { task, project } = await loadTask(parseId(req.params.taskId), req.user);
  assertActive(project);
  const { body } = parseBody(commentSchema, req.body);

  const commentId = await withTransaction(async (db) => {
    const { rows } = await db.query(
      'INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING id',
      [task.id, req.user.id, body],
    );
    const { rows: members } = await db.query(
      'SELECT u.id, u.full_name FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = $1',
      [task.project_id],
    );
    // Les personnes mentionnées reçoivent une « mention », les autres assignés un « commentaire ».
    const mentioned = findMentions(body, members);
    await notify(db, {
      userIds: mentioned,
      type: 'mention',
      taskId: task.id,
      actorId: req.user.id,
      message: `${req.user.full_name} vous a mentionné dans « ${task.title} »`,
    });
    await notify(db, {
      userIds: task.assignees.map((a) => a.id).filter((id) => !mentioned.includes(id)),
      type: 'commentaire',
      taskId: task.id,
      actorId: req.user.id,
      message: `${req.user.full_name} a commenté « ${task.title} »`,
    });
    return rows[0].id;
  });

  const { rows } = await query(`${COMMENT_SELECT} WHERE c.id = $1`, [commentId]);
  res.status(201).json(rows[0]);
});

comments.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query('SELECT task_id, author_id FROM comments WHERE id = $1', [id]);
  const comment = rows[0];
  if (!comment) throw new HttpError(404, 'Commentaire introuvable');
  const { project, canManage } = await loadTask(comment.task_id, req.user);
  if (comment.author_id !== req.user.id && !canManage) {
    throw new HttpError(403, 'Vous ne pouvez supprimer que vos propres commentaires');
  }
  assertActive(project);
  await query('DELETE FROM comments WHERE id = $1', [id]);
  res.status(204).end();
});
