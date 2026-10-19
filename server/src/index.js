import { app } from './app.js';
import { config } from './config.js';
import { dbHint, pool } from './db.js';
import { startJobs } from './lib/jobs.js';
import { mailMode } from './lib/mailer.js';

// Vérifie la base avant d'accepter des requêtes, pour afficher un message clair si elle n'est pas prête.
try {
  await pool.query('SELECT 1 FROM notifications LIMIT 1');
} catch (err) {
  console.error(`Impossible d'utiliser la base « ${config.db.database} » sur ${config.db.host}:${config.db.port}.`);
  console.error(`→ ${err.code === '42P01' ? 'Des tables manquent : lancez « npm run db:migrate -w server ».' : dbHint(err)}`);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`API démarrée sur http://localhost:${config.port}`);
  console.log(`E-mails de notification : ${mailMode}`);
  startJobs();
});
