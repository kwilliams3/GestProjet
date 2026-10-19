import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { query } from '../db.js';

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    })
  : null;

export const mailMode = transport ? `SMTP ${config.smtp.host}:${config.smtp.port}` : 'simulé (affiché dans la console)';

/** Envoie un e-mail ; renvoie false s'il a seulement été affiché dans la console (SMTP non configuré). */
export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`[e-mail simulé] à ${to} : ${subject}\n${text}`);
    return false;
  }
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}

/**
 * Envoie par e-mail les notifications qui ne l'ont pas encore été.
 * Une notification restée en échec est retentée au passage suivant, pendant 24 h au plus.
 */
export async function sendPendingEmails() {
  const { rows } = await query(
    `SELECT n.id, n.message, n.task_id, t.project_id, u.email, u.full_name
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     LEFT JOIN tasks t ON t.id = n.task_id
     WHERE n.emailed_at IS NULL AND n.created_at > now() - interval '1 day'
     ORDER BY n.id
     LIMIT 50`,
  );

  for (const n of rows) {
    const link = n.task_id ? `${config.appUrl}/projets/${n.project_id}?tache=${n.task_id}` : config.appUrl;
    try {
      await sendMail({
        to: n.email,
        subject: `GestProjet : ${n.message}`,
        text: `Bonjour ${n.full_name},\n\n${n.message}.\n\nOuvrir dans GestProjet : ${link}\n`,
      });
      await query('UPDATE notifications SET emailed_at = now() WHERE id = $1', [n.id]);
    } catch (err) {
      console.error(`Envoi de l'e-mail à ${n.email} impossible : ${err.message}`);
    }
  }
}
