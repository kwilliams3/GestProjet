import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../lib/http.js';

export async function requireAuth(req, res, next) {
  const header = req.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentification requise');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Session expirée, veuillez vous reconnecter');
  }

  // Le rôle est relu en base à chaque requête : un changement de rôle s'applique immédiatement.
  const { rows } = await query('SELECT id, email, full_name, role FROM users WHERE id = $1', [payload.sub]);
  if (rows.length === 0) throw new HttpError(401, 'Compte introuvable');
  req.user = rows[0];
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "Vous n'avez pas les droits pour cette action");
    }
    next();
  };
}
