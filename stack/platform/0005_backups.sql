-- Backups and the drills that prove they restore.
--
-- The record lives in the operator's database, next to the schema history, so
-- the studio and the CLI read the same rows and no file has to be kept in step.

CREATE TABLE IF NOT EXISTS baseplate.backups (
  id bigserial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  bytes bigint NOT NULL,
  sha256 text NOT NULL,
  destination text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean NOT NULL DEFAULT false,
  message text
);

--> statement-breakpoint

-- A backup nobody has restored is a hope, not a backup. This is the record of
-- actually doing it: download, decrypt, restore into a scratch database, and
-- count what came back.
CREATE TABLE IF NOT EXISTS baseplate.restore_drills (
  id bigserial PRIMARY KEY,
  backup_id bigint REFERENCES baseplate.backups(id) ON DELETE SET NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT false,
  tables integer NOT NULL DEFAULT 0,
  rows_restored bigint NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  message text
);

--> statement-breakpoint

-- How the operator asks for one. The backup service listens on this rather than
-- opening a port of its own, so nothing new is exposed.
--
-- It has a schema to itself because a backup must not contain it. A restore
-- replaces everything in the dump, and the row asking for the restore is here:
-- include it and the restore erases the note it is answering, leaving whoever
-- asked waiting for a reply that can no longer be written. A whole schema can
-- be left out of a dump; a single table inside a dumped schema cannot, because
-- the dump still carries the DROP SCHEMA that then fails.
CREATE SCHEMA IF NOT EXISTS baseplate_control;

CREATE TABLE IF NOT EXISTS baseplate_control.backup_requests (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('backup', 'drill', 'restore')),
  backup_id bigint,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  ok boolean,
  message text
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS backup_requests_pending
  ON baseplate_control.backup_requests (requested_at)
  WHERE finished_at IS NULL;
