-- Baseplate's own tables. The app does not own these and drizzle does not see them.
-- Written idempotently so an existing volume adopts the ledger without a reset.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO app_user;

--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS auth;

REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO auth_service;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON auth.users TO auth_service;
