import { Router } from 'express';
import { query } from '../db.js';
import { VISIBLE_PROJECT, visibilityParams } from '../lib/access.js';

// F17 : recherche globale dans les projets et les tâches visibles, sans tenir compte des accents ni de la casse.
const router = Router();

router.get('/', async (req, res) => {
  const text = String(req.query.q ?? '').trim().slice(0, 100);
  if (text.length < 2) return res.json({ projects: [], tasks: [] });

  // Les caractères spéciaux de LIKE (% _ \) sont échappés pour être cherchés tels quels.
  const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const params = [...visibilityParams(req.user), pattern];

  const { rows: projects } = await query(
    `SELECT p.id, p.name, p.status, p.is_template
     FROM projects p
     WHERE ${VISIBLE_PROJECT}
       AND (unaccent(p.name) ILIKE unaccent($4) OR unaccent(p.description) ILIKE unaccent($4))
     ORDER BY p.status, p.name
     LIMIT 6`,
    params,
  );

  const { rows: tasks } = await query(
    `SELECT t.id, t.title, t.status, t.project_id, p.name AS project_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE ${VISIBLE_PROJECT}
       AND (unaccent(t.title) ILIKE unaccent($4)
            OR unaccent(t.description) ILIKE unaccent($4)
            OR EXISTS (SELECT 1 FROM unnest(t.labels) AS label WHERE unaccent(label) ILIKE unaccent($4)))
     ORDER BY (t.status = 'termine'), t.updated_at DESC
     LIMIT 10`,
    params,
  );

  res.json({ projects, tasks });
});

export default router;
