import { Router } from 'express';
import { query } from '../db.js';
import { parseId } from '../lib/http.js';

// F13 : notifications de l'utilisateur connecté (les 30 dernières + nombre de non lues).
const router = Router();

router.get('/', async (req, res) => {
  const { rows: items } = await query(
    `SELECT n.id, n.type, n.message, n.task_id, t.project_id, n.read_at, n.created_at
     FROM notifications n
     LEFT JOIN tasks t ON t.id = n.task_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT 30`,
    [req.user.id],
  );
  const { rows } = await query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [req.user.id],
  );
  res.json({ unread_count: rows[0].count, items });
});

router.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.status(204).end();
});

router.post('/:id/read', async (req, res) => {
  await query(
    'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL',
    [parseId(req.params.id), req.user.id],
  );
  res.status(204).end();
});

export default router;
