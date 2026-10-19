// Applique, dans l'ordre, les fichiers db/migrations/*.sql qui ne l'ont pas encore été.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { dbHint, pool, withTransaction } from '../src/db.js';

const dir = path.join(import.meta.dirname, '..', 'db', 'migrations');

try {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const pending = (await readdir(dir)).filter((file) => file.endsWith('.sql') && !applied.has(file)).sort();

  for (const file of pending) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    await withTransaction(async (db) => {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`Migration appliquée : ${file}`);
  }
  if (pending.length === 0) console.log('Base déjà à jour.');
} catch (err) {
  console.error(`Échec de la migration → ${dbHint(err)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
