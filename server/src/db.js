import pg from 'pg';
import { config } from './config.js';

// Conversion des types PostgreSQL renvoyés par le driver :
// - DATE reste une chaîne 'AAAA-MM-JJ' (évite les décalages de fuseau horaire) ;
// - BIGINT (résultat de COUNT) et NUMERIC deviennent des nombres JavaScript.
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);

export const pool = new pg.Pool(config.db);

export function query(text, params) {
  return pool.query(text, params);
}

/** Exécute fn(client) dans une transaction : tout est validé, ou tout est annulé en cas d'erreur. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Met à jour les colonnes présentes dans `values` (et updated_at).
 * Les noms de colonnes viennent toujours du code, jamais de la requête HTTP.
 */
export async function updateRow(db, table, id, values) {
  const columns = Object.keys(values);
  if (columns.length === 0) return;
  const assignments = columns.map((column, i) => `${column} = $${i + 2}`);
  await db.query(
    `UPDATE ${table} SET ${assignments.join(', ')}, updated_at = now() WHERE id = $1`,
    [id, ...Object.values(values)],
  );
}

/** Message d'aide quand la connexion à PostgreSQL échoue. */
export function dbHint(err) {
  switch (err.code) {
    case '28P01':
      return 'Mot de passe refusé : vérifiez DB_PASSWORD dans server/.env.';
    case '3D000':
      return "La base n'existe pas encore : lancez « npm run db:setup ».";
    case '42P01':
      return 'Les tables sont absentes : lancez « npm run db:setup ».';
    case 'ECONNREFUSED':
      return 'PostgreSQL ne répond pas : vérifiez que le service est démarré.';
    default:
      return err.message;
  }
}
