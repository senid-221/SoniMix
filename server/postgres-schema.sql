-- SoniMix durable PostgreSQL schema.
-- Apply to the target database only after a backup and before routing production
-- traffic to the new runtime. This schema intentionally preserves the columns
-- and response shapes used by the existing SQLite implementation.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at bigint NOT NULL,
  google_sub text UNIQUE
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  state text NOT NULL CHECK (state IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  locked_at bigint,
  locked_by text,
  available_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  error text
);
CREATE INDEX IF NOT EXISTS jobs_user_created_idx ON jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_claim_idx ON jobs(state, available_at, created_at) WHERE state IN ('queued', 'processing');

CREATE TABLE IF NOT EXISTS exports (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  title text NOT NULL,
  format text NOT NULL,
  file_size bigint NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS exports_user_created_idx ON exports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  path text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id text,
  file_size bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  content_type text,
  blob_url text
);
CREATE INDEX IF NOT EXISTS files_user_created_idx ON files(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version) VALUES ('2026-10-13-initial-postgres')
ON CONFLICT (version) DO NOTHING;
