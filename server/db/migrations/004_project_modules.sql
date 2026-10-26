-- Budget, documents and time tracking for project modules.

CREATE TABLE project_expenses (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  amount     NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  spent_on   DATE NOT NULL DEFAULT current_date,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_expenses_project_idx ON project_expenses (project_id, spent_on DESC);

CREATE TABLE time_entries (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  task_id     INTEGER REFERENCES tasks (id) ON DELETE SET NULL,
  user_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  minutes     INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  worked_on   DATE NOT NULL DEFAULT current_date,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX time_entries_project_idx ON time_entries (project_id, worked_on DESC);
CREATE INDEX time_entries_user_idx ON time_entries (user_id);

CREATE TABLE project_documents (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  uploaded_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  storage_key   TEXT NOT NULL UNIQUE,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_documents_project_idx ON project_documents (project_id, created_at DESC);
