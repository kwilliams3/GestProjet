import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import { createAccount, signToken } from '../lib/accounts.js';
import { HttpError, parseBody } from '../lib/http.js';
import { emailSchema, fullNameSchema, passwordSchema, z } from '../lib/schemas.js';
import { enabledProviders } from '../lib/sso.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({ full_name: fullNameSchema, email: emailSchema, password: passwordSchema });
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });

// Fournisseurs SSO configurés, pour afficher les boutons « Continuer avec … ».
router.get('/providers', (req, res) => {
  res.json(enabledProviders());
});

router.post('/register', async (req, res) => {
  const data = parseBody(registerSchema, req.body);
  const existing = await query('SELECT 1 FROM users WHERE email = $1', [data.email]);
  if (existing.rowCount > 0) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await createAccount(pool, { email: data.email, fullName: data.full_name, passwordHash });
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req, res) => {
  const data = parseBody(loginSchema, req.body);
  const { rows } = await query(
    'SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1',
    [data.email],
  );
  const found = rows[0];
  // Un compte créé par SSO n'a pas de mot de passe : seule la connexion Google/Microsoft fonctionne.
  const valid = Boolean(found?.password_hash) && (await bcrypt.compare(data.password, found.password_hash));
  if (!valid) throw new HttpError(401, 'E-mail ou mot de passe incorrect');

  const { password_hash: _hash, ...user } = found;
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
