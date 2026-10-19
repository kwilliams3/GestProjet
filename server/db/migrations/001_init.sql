-- Lot 1 : utilisateurs, projets, membres, tâches et assignations.

CREATE TYPE user_role AS ENUM ('admin', 'chef_projet', 'membre', 'invite');
CREATE TYPE project_status AS ENUM ('actif', 'archive');
CREATE TYPE task_status AS ENUM ('a_faire', 'en_cours', 'termine');
CREATE TYPE task_priority AS ENUM ('basse', 'moyenne', 'haute', 'urgente');

CREATE TABLE users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'membre',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objectives  TEXT NOT NULL DEFAULT '',
  start_date  DATE,
  end_date    DATE,
  budget      NUMERIC(14, 2) CHECK (budget >= 0),
  status      project_status NOT NULL DEFAULT 'actif',
  is_template BOOLEAN NOT NULL DEFAULT false,
  owner_id    INTEGER NOT NULL REFERENCES users (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE project_members (
  project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user_idx ON project_members (user_id);

CREATE TABLE tasks (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  parent_id    INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       task_status NOT NULL DEFAULT 'a_faire',
  priority     task_priority NOT NULL DEFAULT 'moyenne',
  due_date     DATE,
  labels       TEXT[] NOT NULL DEFAULT '{}',
  position     DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX tasks_project_idx ON tasks (project_id);
CREATE INDEX tasks_parent_idx ON tasks (parent_id);

CREATE TABLE task_assignees (
  task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX task_assignees_user_idx ON task_assignees (user_id);
