import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, parseBody, parseId } from '../lib/http.js';
import { ROLES, z } from '../lib/schemas.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Liste utilisée pour choisir les membres d'un projet.
router.get('/', requireRole('admin', 'chef_projet'), async (req, res) => {
  const { rows } = await query('SELECT id, email, full_name, role, created_at FROM users ORDER BY full_name');
  res.json(rows);
});

const roleSchema = z.object({ role: z.enum(ROLES) });

router.patch('/:id/role', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const { role } = parseBody(roleSchema, req.body);
  if (id === req.user.id && role !== 'admin') {
    throw new HttpError(400, 'Vous ne pouvez pas retirer votre propre rôle administrateur');
  }
  const { rows } = await query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, full_name, role, created_at',
    [role, id],
  );
  if (rows.length === 0) throw new HttpError(404, 'Utilisateur introuvable');
  res.json(rows[0]);
});

export default router;
