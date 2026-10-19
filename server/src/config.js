import path from 'node:path';

// Configuration lue depuis server/.env (chargé par l'option --env-file de Node).
const required = ['DB_PASSWORD', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Variable(s) manquante(s) dans server/.env : ${missing.join(', ')}`);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  // Adresse de l'interface, utilisée pour les liens dans les e-mails.
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  // Dossier des pièces jointes (server/uploads par défaut).
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(import.meta.dirname, '..', 'uploads')),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'gestion_projet',
  },
  // Connexion SSO : un fournisseur n'est proposé que si son identifiant et son secret sont renseignés.
  sso: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenant: process.env.MICROSOFT_TENANT || 'organizations',
    },
  },
  // Sans SMTP_HOST, les e-mails sont simplement affichés dans la console du serveur.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'GestProjet <no-reply@gestprojet.local>',
  },
};
