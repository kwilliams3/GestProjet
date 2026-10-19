// Crée la base de données si elle n'existe pas encore.
import pg from 'pg';
import { config } from '../src/config.js';
import { dbHint } from '../src/db.js';

const client = new pg.Client({ ...config.db, database: 'postgres' });

try {
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
  if (rowCount > 0) {
    console.log(`La base « ${config.db.database} » existe déjà.`);
  } else {
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(config.db.database)}`);
    console.log(`Base « ${config.db.database} » créée.`);
  }
} catch (err) {
  console.error(`Échec de la création de la base → ${dbHint(err)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
