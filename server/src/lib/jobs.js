import { sendPendingEmails } from './mailer.js';
import { createDueReminders } from './notifications.js';

const running = new Set();

async function run(name, job) {
  if (running.has(name)) return; // le passage précédent n'est pas terminé
  running.add(name);
  try {
    await job();
  } catch (err) {
    console.error(`Tâche planifiée « ${name} » en échec : ${err.message}`);
  } finally {
    running.delete(name);
  }
}

/** Tâches de fond : rappels d'échéance toutes les 15 min, envoi des e-mails toutes les 30 s. */
export function startJobs() {
  const reminders = () => run('rappels', createDueReminders);
  const emails = () => run('e-mails', sendPendingEmails);
  reminders().then(emails);
  setInterval(reminders, 15 * 60 * 1000);
  setInterval(emails, 30 * 1000);
}
