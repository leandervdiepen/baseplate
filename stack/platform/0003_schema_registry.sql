-- The database, not a repo file, is the source of truth for app tables.
-- An operator changes schema from the dashboard; this is where that lands.

CREATE SCHEMA IF NOT EXISTS baseplate;

CREATE TABLE IF NOT EXISTS baseplate.tables (
  name text PRIMARY KEY,
  owner_column text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS baseplate.schema_history (
  id bigserial PRIMARY KEY,
  change text NOT NULL,
  statement text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- Adopt a database created before the registry existed: anything in public that
-- has an owner_id is an app table that was already under row access.
INSERT INTO baseplate.tables (name, owner_column)
SELECT c.relname, 'owner_id'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND a.attname = 'owner_id'
  AND NOT a.attisdropped
ON CONFLICT (name) DO NOTHING;
