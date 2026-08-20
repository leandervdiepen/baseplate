Proof of done. Plain HTTP, no test framework.

Needs a running stack: `./scripts/dev init` then `./scripts/dev up`.
Then `npm run test:acceptance`, which is the list of what runs and in what order.

- `two-token.sh` - two callers, one endpoint, disjoint rows.
  A missing token and a tampered one get nothing.
- `signup-login.sh` - email and password on the stack, and the session it returns.
- `object-access.sh` - the same proof for files: two users, one bucket, and neither
  can read, overwrite, or delete the other's object.
- `password-reset.sh` - a forgotten password, start to finish.
  The token is read out of the local Mailpit inbox, the way a user reads their mail.
- `backup-restore.sh` - the recovery path end to end.
  A backup is taken, sealed and recorded, the row that was in it is destroyed,
  `baseplate restore` puts it back by id, and the recovered database still answers
  with row access on.
  It runs last, because a restore rewinds the database past whatever ran before it.

`lib.sh` is sourced by all of them.
It holds the base URL, a JSON field reader, collision-resistant test identities, and
`auth_post`, which waits out the credential rate limit instead of asserting against it.
Every call to an auth endpoint goes through `auth_post`: ten a minute per IP is the
product working, and a script that fails on it is testing the clock.

Point them somewhere else with `BASEPLATE_URL=https://<hostname>`.
`password-reset.sh` also needs the inbox; point it with `MAILPIT_URL=...`.
