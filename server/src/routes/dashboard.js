import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// F15 : avancement des projets actifs visibles par l'utilisateur et charge de travail par membre.
router.get('/', async (req, res) => {
  const { rows: projects } = await query(
    `SELECT p.id, p.name, p.end_date,
            COUNT(t.id) AS total,
            COUNT(t.id) FILTER (WHERE t.status = 'termine') AS done,
            COUNT(t.id) FILTER (WHERE t.status = 'en_cours') AS in_progress,
            COUNT(t.id) FILTER (WHERE t.status <> 'termine' AND t.due_date < current_date) AS overdue
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.status = 'actif' AND NOT p.is_template
       AND ($1::boolean OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $2))
     GROUP BY p.id
     ORDER BY p.end_date NULLS LAST, p.name`,
    [req.user.role === 'admin', req.user.id],
  );

  const { rows: workload } = await query(
    `SELECT u.id, u.full_name,
            COUNT(*) FILTER (WHERE t.status <> 'termine') AS open_tasks,
            COUNT(*) FILTER (WHERE t.status = 'en_cours') AS in_progress,
            COUNT(*) FILTER (WHERE t.status <> 'termine' AND t.due_date < current_date) AS overdue
     FROM task_assignees ta
     JOIN tasks t ON t.id = ta.task_id
     JOIN users u ON u.id = ta.user_id
     WHERE t.project_id = ANY($1::int[])
     GROUP BY u.id
     ORDER BY open_tasks DESC, u.full_name`,
    [projects.map((p) => p.id)],
  );

  const totals = { total: 0, done: 0, in_progress: 0, overdue: 0 };
  for (const project of projects) {
    for (const key of Object.keys(totals)) totals[key] += project[key];
  }

  res.json({ totals, projects, workload });
});

export default router;
