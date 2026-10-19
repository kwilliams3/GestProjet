-- Invitations par e-mail (F02) et connexion SSO Google / Microsoft (F01).

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL,                 -- un compte créé par SSO n'a pas de mot de passe
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false, -- vrai si l'adresse a été prouvée (invitation, SSO)
  ADD COLUMN sso_provider TEXT,
  ADD COLUMN sso_subject TEXT;
CREATE UNIQUE INDEX users_sso_idx ON users (sso_provider, sso_subject) WHERE sso_provider IS NOT NULL;

CREATE TABLE invitations (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       TEXT NOT NULL,
  role        user_role NOT NULL,
  project_id  INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  token_hash  TEXT NOT NULL UNIQUE,  -- empreinte SHA-256 du lien envoyé (le lien lui-même n'est pas conservé)
  invited_by  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Une seule invitation en attente par adresse.
CREATE UNIQUE INDEX invitations_pending_email_idx ON invitations (email) WHERE accepted_at IS NULL;
