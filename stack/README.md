The declared running system: Compose, Caddy, Postgres schema, user auth HTTP, and stack.json.
Same files run locally and on the cloud server.

`POST /auth/signup` and `POST /auth/login` are public.
They issue the same HS256 JWTs PostgREST already trusts.
There is no public key.
Users live in schema `auth`, which PostgREST does not expose.
