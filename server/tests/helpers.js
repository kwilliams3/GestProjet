import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const serverDir = path.join(import.meta.dirname, '..');

/**
 * Démarre l'API sur une base de test neuve (créée, migrée, remplie avec le jeu de démonstration)
 * et un dossier de pièces jointes temporaire. close() supprime l'une et l'autre.
 */
export async function startTestServer(name) {
  process.env.DB_NAME = `gestion_projet_test_${name}`;
  process.env.UPLOAD_DIR = await mkdtemp(path.join(os.tmpdir(), 'gestprojet-'));
  await dropDatabase();
  for (const script of ['db-create.js', 'migrate.js', 'seed.js']) {
    execFileSync(process.execPath, [path.join('scripts', script)], { cwd: serverDir, env: process.env, stdio: 'pipe' });
  }

  // Les e-mails simulés et autres traces du serveur encombreraient le rapport de test.
  console.log = () => {};

  const { app } = await import('../src/app.js');
  const { pool } = await import('../src/db.js');
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://localhost:${server.address().port}/api`;

  /** Appelle l'API ; renvoie { status, data, headers } (data : JSON, ou Buffer pour un fichier). */
  async function call(token, method, url, body, { headers = {}, redirect = 'follow' } = {}) {
    const allHeaders = { ...headers };
    if (token) allHeaders.Authorization = `Bearer ${token}`;
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) allHeaders['Content-Type'] = 'application/json';
    const res = await fetch(base + url, {
      method,
      headers: allHeaders,
      redirect,
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });
    let data = null;
    if (res.status !== 204) {
      data = (res.headers.get('content-type') ?? '').includes('json')
        ? await res.json()
        : Buffer.from(await res.arrayBuffer());
    }
    return { status: res.status, data, headers: res.headers };
  }

  const login = async (email, password = 'Demo1234!') =>
    (await call(null, 'POST', '/auth/login', { email, password })).data;

  return {
    pool,
    call,
    login,
    storedFiles: async () => (await readdir(process.env.UPLOAD_DIR)).length,
    async close() {
      server.closeAllConnections();
      server.close();
      await pool.end();
      await dropDatabase();
      await rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
    },
  };
}

async function dropDatabase() {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${client.escapeIdentifier(process.env.DB_NAME)} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

/** Date 'AAAA-MM-JJ' décalée de `offset` jours par rapport à aujourd'hui. */
export function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fileForm(name, content) {
  const form = new FormData();
  form.append('file', new Blob([content]), name);
  return form;
}
