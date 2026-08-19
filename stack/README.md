The declared running system: Compose, Caddy, migrations, user auth HTTP, and stack.json.
Same files run locally and on the cloud server.

`migrate/` runs before PostgREST and auth on every `up`.
It ensures roles, applies pending files from `migrations/`, then re-applies row access from `stack.json`.
A table with no declared policy is locked: RLS on, no grants.

`POST /auth/signup` and `POST /auth/login` are public.
They issue the same HS256 JWTs PostgREST already trusts.
There is no public key.
Users live in schema `auth`, which PostgREST does not expose.
