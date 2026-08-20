The running system: Compose, Caddy, the platform schema, and the services.
The same files run locally and on a cloud server.

`migrate/` runs before everything else on every `up`.
It ensures roles, applies pending files from `platform/`, re-asserts the grants
each service needs, and re-applies row access from `baseplate.tables`.
A table in `public` with no declared policy is locked: row security on, every
grant revoked.

`platform/` is Baseplate's own schema, versioned with the package.
There is no directory for an operator's tables, by design: those live in their
database and are recorded there.

`auth/` is `POST /auth/signup`, `/login`, `/refresh`, `/logout`, all public.
They issue the same HS256 JWTs PostgREST already trusts.
Users live in schema `auth`, which PostgREST does not expose.
There is no public key.

`storage/` is `/storage/*`: objects, guarded by the same row security as rows.
It asks Postgres as the caller and streams bytes to the blob store beside it,
which is on the compose network only.

`backup/` dumps on a schedule, seals the dump, sends it where the operator said,
and restores one into a scratch database to prove it still works.

`shared/` is what more than one service needs: SigV4, duration parsing, and the
sealing.
