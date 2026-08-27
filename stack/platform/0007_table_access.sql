-- Who may read a table's rows. Writes are the owner's in every mode, so this
-- widens reads and nothing else. Existing tables stay private.

ALTER TABLE baseplate.tables
  ADD COLUMN IF NOT EXISTS access text NOT NULL DEFAULT 'private';

--> statement-breakpoint

ALTER TABLE baseplate.tables DROP CONSTRAINT IF EXISTS tables_access;

--> statement-breakpoint

ALTER TABLE baseplate.tables
  ADD CONSTRAINT tables_access CHECK (access IN ('private', 'shared', 'public'));
