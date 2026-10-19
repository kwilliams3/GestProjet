import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { withTransaction } from '../db.js';

export const PUBLIC_USER_COLUMNS = 'id, email, full_name, role';

export function signToken(user) {
  return jwt.sign({}, config.jwtSecret, { subject: String(user.id), expiresIn: config.jwtExpiresIn });
}

/** Invitation en attente et non expirée pour cette adresse, s'il y en a une. */
export async function findPendingInvitation(db, email) {
  const { rows } = await db.query(
    'SELECT * FROM invitations WHERE email = $1 AND accepted_at IS NULL AND expires_at > now()',
    [email],
  );
  return rows[0] ?? null;
}

/**
 * Crée un compte. Sans invitation, le tout premier compte devient administrateur et les suivants
 * membres d'équipe ; avec une invitation, le rôle et le projet de l'invitation s'appliquent.
 */
export async function createAccount(
  db,
  { email, fullName, passwordHash = null, emailVerified = false, sso = null, invitation = null },
) {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, email_verified, sso_provider, sso_subject)
     VALUES ($1, $2, $3,
             COALESCE($4::user_role,
                      CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'membre' ELSE 'admin' END::user_role),
             $5, $6, $7)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [email, passwordHash, fullName, invitation?.role ?? null, emailVerified, sso?.provider ?? null, sso?.subject ?? null],
  );
  const user = rows[0];
  if (invitation) {
    await db.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [invitation.id]);
    if (invitation.project_id) {
      await db.query(
        'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [invitation.project_id, user.id],
      );
    }
  }
  return user;
}

/** Retrouve, relie ou crée le compte correspondant à une identité confirmée par Google ou Microsoft. */
export function findOrCreateSsoUser(provider, { subject, email, fullName }) {
  return withTransaction(async (db) => {
    const { rows: known } = await db.query(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE sso_provider = $1 AND sso_subject = $2`,
      [provider, subject],
    );
    if (known[0]) return known[0];

    const { rows: sameEmail } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (sameEmail[0]) {
      // Compte existant relié au fournisseur. S'il avait été créé par simple inscription (adresse jamais
      // vérifiée), son mot de passe est effacé : il a pu être choisi par quelqu'un d'autre que le titulaire.
      const { rows: linked } = await db.query(
        `UPDATE users
         SET sso_provider = $2, sso_subject = $3,
             password_hash = CASE WHEN email_verified THEN password_hash END,
             email_verified = true
         WHERE id = $1
         RETURNING ${PUBLIC_USER_COLUMNS}`,
        [sameEmail[0].id, provider, subject],
      );
      return linked[0];
    }

    const invitation = await findPendingInvitation(db, email);
    return createAccount(db, { email, fullName, emailVerified: true, sso: { provider, subject }, invitation });
  });
}
