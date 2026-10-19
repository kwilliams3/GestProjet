/** Erreur renvoyée telle quelle au client avec le code HTTP indiqué. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Valide `data` avec un schéma zod ; lève une erreur 400 détaillée si c'est invalide. */
export function parseBody(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new HttpError(400, 'Données invalides', details);
  }
  return result.data;
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Ressource introuvable');
  return id;
}

/** Garde uniquement les clés listées dont la valeur est définie (null compris). */
export function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}
