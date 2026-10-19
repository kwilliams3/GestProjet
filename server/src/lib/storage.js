import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// Pièces jointes stockées sur disque sous un nom aléatoire (le nom d'origine est en base).
// Pour la production, ce module est le seul à remplacer par un stockage objet compatible S3.

await mkdir(config.uploadDir, { recursive: true });

export const storedFilePath = (key) => path.join(config.uploadDir, key);

export async function removeStoredFiles(keys) {
  await Promise.all(keys.map((key) => unlink(storedFilePath(key)).catch(() => {})));
}
