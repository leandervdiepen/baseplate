Proof of done. Plain HTTP, no test framework.

Needs a running stack: `./scripts/dev init` then `./scripts/dev up`.
Then `npm run test:acceptance`.

- `two-token.sh` — two callers, one endpoint, disjoint rows. A missing token and
  a tampered one get nothing.
- `signup-login.sh` — email and password on the stack, and the session it returns.
- `object-access.sh` — the same proof for files: two users, one bucket, and
  neither can read, overwrite, or delete the other's object.
- `password-reset.sh` - a forgotten password, start to finish: the token is read
  out of the local Mailpit inbox, the way a user reads their mail.

Point them somewhere else with `BASEPLATE_URL=https://<hostname>`.
`password-reset.sh` also needs the inbox; point it with `MAILPIT_URL=...`.
