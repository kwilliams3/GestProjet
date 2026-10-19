import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, parseBody, parseId } from '../lib/http.js';
import { TASK_PRIORITIES, z } from '../lib/schemas.js';

// F17 : filtres de tâches enregistrés par chaque utilisateur.
const router = Router();

const filterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  criteria: z
    .object({
      q: z.string().max(100),
      assignee: z.string().max(20), // '' | 'me' | 'none' | identifiant d'un membre
      priority: z.enum(['', ...TASK_PRIORITIES]),
      label: z.string().max(30),
      overdue: z.boolean(),
    })
    .partial(),
});

router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, criteria FROM saved_filters WHERE user_id = $1 ORDER BY name',
    [req.user.id],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const data = parseBody(filterSchema, req.body);
  const { rows } = await query(
    'INSERT INTO saved_filters (user_id, name, criteria) VALUES ($1, $2, $3) RETURNING id, name, criteria',
    [req.user.id, data.name, JSON.stringify(data.criteria)],
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM saved_filters WHERE id = $1 AND user_id = $2', [
    parseId(req.params.id),
    req.user.id,
  ]);
  if (rowCount === 0) throw new HttpError(404, 'Filtre introuvable');
  res.status(204).end();
});

export default router;
