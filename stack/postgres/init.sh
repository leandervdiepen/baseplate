#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE anon NOLOGIN;
CREATE ROLE app_user NOLOGIN;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${AUTHENTICATOR_PASSWORD}';
CREATE ROLE auth_service LOGIN PASSWORD '${AUTH_SERVICE_PASSWORD}';
GRANT anon TO authenticator;
GRANT app_user TO authenticator;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO app_user;

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  body text NOT NULL
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_owner ON items
  USING (owner_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid)
  WITH CHECK (owner_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid);

CREATE FUNCTION set_owner_id() RETURNS trigger AS \$\$
BEGIN
  NEW.owner_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER items_set_owner
  BEFORE INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION set_owner_id();

GRANT SELECT, INSERT, UPDATE, DELETE ON items TO app_user;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO auth_service;
GRANT SELECT, INSERT ON auth.users TO auth_service;
SQL
