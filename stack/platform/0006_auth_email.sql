-- Email flows: password recovery and email verification.
--
-- Written idempotently like the rest, so an existing volume picks up the new
-- columns without a reset.

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

--> statement-breakpoint

-- Signup has always lowercased the address, so this changes nothing for rows
-- that came in that way. It is here to stop any other write path from creating
-- a second account that differs only in case.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON auth.users (lower(email));

--> statement-breakpoint

-- One row per emailed link. Only the hash is stored, the same way refresh
-- tokens are: the value in the mail is never at rest.
CREATE TABLE IF NOT EXISTS auth.one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('recovery', 'email_verify')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS one_time_tokens_user_purpose
  ON auth.one_time_tokens (user_id, purpose);

--> statement-breakpoint

-- Column-limited on purpose. The auth service may set a new password hash and
-- the timestamps that go with it, and nothing else: never the email address,
-- and never a DELETE. Removing a user is the operator's job, not the service's.
GRANT UPDATE (password_hash, email_confirmed_at, last_sign_in_at, updated_at)
  ON auth.users TO auth_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON auth.one_time_tokens TO auth_service;
