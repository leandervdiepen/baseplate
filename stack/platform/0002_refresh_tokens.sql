-- Refresh tokens, so an access token can be short-lived without signing the
-- user out. Only the hash is stored; the value itself is never at rest.

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id ON auth.refresh_tokens (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON auth.refresh_tokens TO auth_service;
