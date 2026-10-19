import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool, query, withTransaction } from '../db.js';
import { loadProject } from '../lib/access.js';
import { createAccount, signToken } from '../lib/accounts.js';
import { HttpError, parseBody, parseId } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';
import { ROLES, emailSchema, fullNameSchema, passwordSchema, z } from '../lib/schemas.js';
import { requireRole } from '../middleware/auth.js';

// F02 : invitations par e-mail. Le lien contient un jeton aléatoire dont seule l'empreinte est conservée.

export const invitations = Router(); // /api/invitations (connecté)
export const publicInvitations = Router(); // /api/invitations/accept (public)

const VALID_DAYS = 7;
const ROLE_LABELS = {
  admin: 'administrateur',
  chef_projet: 'chef de projet',
  membre: "membre d'équipe",
  invite: 'invité',
};

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const INVITATION_SELECT = `
  SELECT i.id, i.email, i.role, i.project_id, p.name AS project_name, i.expires_at, i.created_at,
         i.invited_by, u.full_name AS invited_by_name, (i.expires_at < now()) AS expired
  FROM invitations i
  LEFT JOIN projects p ON p.id = i.project_id
  LEFT JOIN users u ON u.id = i.invited_by`;

const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLES),
  project_id: z.number().int().positive().nullable().optional(),
});

// Administrateur : tout rôle, projet facultatif. Chef de projet : membre ou invité, sur un projet qu'il gère.
invitations.post('/', requireRole('admin', 'chef_projet'), async (req, res) => {
  const data = parseBody(inviteSchema, req.body);
  if (req.user.role !== 'admin') {
    if (!['membre', 'invite'].includes(data.role)) {
      throw new HttpError(403, "Un chef de projet ne peut inviter que des membres d'équipe ou des invités");
    }
    if (!data.project_id) throw new HttpError(400, 'Choisissez le projet auquel inviter la personne');
  }
  let project = null;
  if (data.project_id) {
    const loaded = await loadProject(data.project_id, req.user);
    if (!loaded.canManage) throw new HttpError(403, 'Vous ne gérez pas ce projet');
    project = loaded.project;
  }
  const existing = await query('SELECT 1 FROM users WHERE email = $1', [data.email]);
  if (existing.rowCount > 0) {
    throw new HttpError(409, 'Un compte existe déjà avec cet e-mail : ajoutez directement la personne aux membres du projet');
  }

  const token = randomBytes(32).toString('base64url');
  const invitationId = await withTransaction(async (db) => {
    // Une nouvelle invitation remplace celle encore en attente pour la même adresse (l'ancien lien ne marche plus).
    await db.query('DELETE FROM invitations WHERE email = $1 AND accepted_at IS NULL', [data.email]);
    const { rows } = await db.query(
      `INSERT INTO invitations (email, role, project_id, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
       RETURNING id`,
      [data.email, data.role, data.project_id ?? null, hashToken(token), req.user.id, VALID_DAYS],
    );
    return rows[0].id;
  });

  const link = `${config.appUrl}/invitation/${token}`;
  const where = project ? ` sur le projet « ${project.name} »` : '';
  let emailSent = false;
  try {
    emailSent = await sendMail({
      to: data.email,
      subject: `${req.user.full_name} vous invite sur GestProjet`,
      text:
        `Bonjour,\n\n${req.user.full_name} vous invite à rejoindre GestProjet en tant que ${ROLE_LABELS[data.role]}${where}.\n\n` +
        `Pour créer votre compte, ouvrez ce lien (valable ${VALID_DAYS} jours) :\n${link}\n`,
    });
  } catch (err) {
    console.error(`Envoi de l'invitation à ${data.email} impossible : ${err.message}`);
  }

  const { rows } = await query(`${INVITATION_SELECT} WHERE i.id = $1`, [invitationId]);
  // Le lien est renvoyé à la personne qui invite pour qu'elle puisse le transmettre elle-même.
  res.status(201).json({ ...rows[0], link, email_sent: emailSent });
});

invitations.get('/', requireRole('admin', 'chef_projet'), async (req, res) => {
  const { rows } = await query(
    `${INVITATION_SELECT}
     WHERE i.accepted_at IS NULL AND ($1::boolean OR i.invited_by = $2)
     ORDER BY i.created_at DESC`,
    [req.user.role === 'admin', req.user.id],
  );
  res.json(rows);
});

invitations.delete('/:id', requireRole('admin', 'chef_projet'), async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM invitations WHERE id = $1 AND accepted_at IS NULL AND ($2::boolean OR invited_by = $3)',
    [parseId(req.params.id), req.user.role === 'admin', req.user.id],
  );
  if (rowCount === 0) throw new HttpError(404, 'Invitation introuvable');
  res.status(204).end();
});

async function findValidInvitation(db, token, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT i.*, p.name AS project_name, u.full_name AS invited_by_name
     FROM invitations i
     LEFT JOIN projects p ON p.id = i.project_id
     LEFT JOIN users u ON u.id = i.invited_by
     WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.expires_at > now()
     ${lock ? 'FOR UPDATE OF i' : ''}`,
    [hashToken(token)],
  );
  if (!rows[0]) throw new HttpError(404, 'Invitation invalide, expirée ou déjà utilisée');
  return rows[0];
}

publicInvitations.get('/:token', async (req, res) => {
  const invitation = await findValidInvitation(pool, req.params.token);
  res.json({
    email: invitation.email,
    role: invitation.role,
    project_name: invitation.project_name,
    invited_by_name: invitation.invited_by_name,
  });
});

const acceptSchema = z.object({ full_name: fullNameSchema, password: passwordSchema });

publicInvitations.post('/:token', async (req, res) => {
  const data = parseBody(acceptSchema, req.body);
  const passwordHash = await bcrypt.hash(data.password, 10);
  const { user, projectId } = await withTransaction(async (db) => {
    const invitation = await findValidInvitation(db, req.params.token, { lock: true });
    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [invitation.email]);
    if (existing.rowCount > 0) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail : connectez-vous');
    // L'adresse est prouvée : la personne a reçu le lien.
    const created = await createAccount(db, {
      email: invitation.email,
      fullName: data.full_name,
      passwordHash,
      emailVerified: true,
      invitation,
    });
    return { user: created, projectId: invitation.project_id };
  });
  res.status(201).json({ token: signToken(user), user, project_id: projectId });
});
