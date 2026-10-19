import { HttpError } from '../lib/http.js';

// Erreurs PostgreSQL fréquentes traduites en réponses compréhensibles.
const PG_ERRORS = {
  23505: [409, 'Cet élément existe déjà'],
  23503: [400, 'Référence invalide : un élément lié est introuvable'],
  23514: [400, 'Données incohérentes'],
  22007: [400, 'Date invalide'],
  22008: [400, 'Date invalide'],
  '22P02': [400, 'Format de donnée invalide'],
};

export function notFound(req, res) {
  res.status(404).json({ error: 'Route introuvable' });
}

// eslint-disable-next-line no-unused-vars -- Express reconnaît un gestionnaire d'erreurs à ses 4 paramètres.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps de requête JSON invalide' });
  }
  if (err.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE'
      ? res.status(413).json({ error: 'Fichier trop volumineux (50 Mo maximum)' })
      : res.status(400).json({ error: `Envoi de fichier invalide (${err.code})` });
  }
  if (PG_ERRORS[err.code]) {
    const [status, message] = PG_ERRORS[err.code];
    return res.status(status).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}
