-- Lot 2 : commentaires, pièces jointes, notifications, filtres enregistrés et recherche sans accents.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE comments (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_task_idx ON comments (task_id, created_at);

CREATE TABLE attachments (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id       INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  uploaded_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  storage_key   TEXT NOT NULL UNIQUE,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attachments_task_idx ON attachments (task_id);

CREATE TYPE notification_type AS ENUM ('assignation', 'mention', 'commentaire', 'echeance_proche', 'retard');

CREATE TABLE notifications (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  task_id      INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
  actor_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  reminder_for DATE,          -- échéance concernée, pour les rappels uniquement
  read_at      TIMESTAMPTZ,
  emailed_at   TIMESTAMPTZ,   -- NULL tant que l'e-mail n'est pas parti
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unsent_idx ON notifications (id) WHERE emailed_at IS NULL;
-- Un seul rappel par personne, tâche, type et date d'échéance (un nouveau rappel part si l'échéance change).
CREATE UNIQUE INDEX notifications_reminder_uniq ON notifications (user_id, task_id, type, reminder_for)
  WHERE reminder_for IS NOT NULL;

CREATE TABLE saved_filters (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  criteria   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX saved_filters_user_idx ON saved_filters (user_id);
