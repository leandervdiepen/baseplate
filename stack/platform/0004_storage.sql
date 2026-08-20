-- Object storage. The bytes live in the blob store; who may see them is decided
-- here, by the same row-level security that decides every other row.
--
-- Row access is applied by the migrate service on every start, not here, so a
-- restart cannot leave an object exposed. This file only makes the shape.

CREATE SCHEMA IF NOT EXISTS storage;

REVOKE ALL ON SCHEMA storage FROM PUBLIC;
GRANT USAGE ON SCHEMA storage TO app_user;
GRANT USAGE ON SCHEMA storage TO storage_service;

--> statement-breakpoint

-- A bucket is the operator's to create, like a table. Nothing an app does
-- makes one.
CREATE TABLE IF NOT EXISTS storage.buckets (
  name text PRIMARY KEY,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- One row per object. The key is the name inside the bucket, and it is one flat
-- namespace: a key is taken or it is not, whoever took it.
CREATE TABLE IF NOT EXISTS storage.objects (
  bucket text NOT NULL REFERENCES storage.buckets(name) ON DELETE CASCADE,
  key text NOT NULL,
  owner_id uuid NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS objects_owner ON storage.objects (owner_id, bucket, key);
