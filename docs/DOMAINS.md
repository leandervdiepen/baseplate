# Domains

This is the product language and the rules for each concept.
Code uses these names.
If a name here and a name in code disagree, that is a bug.

Vendor names (Hetzner, PostgREST, Caddy, Docker, Terraform) are not domain types.
They belong in `infra/`, `stack/`, or `src/infrastructure/<system>/`.

## Stack

The declared backend a caller talks to.
A stack has a name, a hostname, one database, and the access policies on that database.

Invariant: a stack has at least one table.
Invariant: every access policy names a table that exists on the stack's database.
Invariant: a table that has an access policy has an owner column, and the policy uses that column.

The file `stack/stack.json` is the data.
`stack/compose.yaml`, `stack/Caddyfile`, and `stack/postgres/` are how that stack runs.

## Server

The machine the stack runs on.

Locally the server is the operator's Docker engine, addressed as `127.0.0.1`.
On Hetzner it is one VM in the operator's account (BYOK), with a public IPv4.

A server has an id, an IPv4 address, and a status (`pending` or `running`).

## Database

Postgres, one catalog.
It contains tables.
Phase A ships one table, `items`, so the access model is real and testable.

## Table

A named relation with an owner column.
The owner column holds the caller's id.
Rows without an owner are not a thing we allow on a table that has an access policy.

## Access policy

The rule that a caller sees and writes only rows whose owner column equals the caller id in their token.
Enforced inside the database (row-level security plus a check that insert/update cannot change ownership to someone else).
Not enforced in TypeScript.
Not enforced in PostgREST configuration beyond "use this JWT and this database role".

If filtering happens in an application server, the policy is in the wrong place.

## Caller

The subject of a signed token.
Identified by a `CallerId` (UUID, claim `sub`).
Signup creates a row in `auth.users` and uses that id as `sub`.
The operator can still mint a token for any UUID (tests and impersonation).

## User

An email + password account stored in schema `auth`, not in `public`.
PostgREST does not expose `auth.users`.
Passwords are hashed (scrypt).
Login is HTTP on the stack (`POST /auth/signup`, `POST /auth/login`).
There is no public key and no anon JWT for apps.
`JWT_SECRET` stays on the server.
The browser or SDK receives a user JWT after login.

## Token

A signed JWT.
Claims that matter: `sub` (caller id) and `role` (the database role PostgREST switches to).
The stack auth service and `mint-token` both produce tokens the API already trusts.

A missing token is not a caller.
A token with a broken signature is not a caller.
Both get nothing from the API.

## Operator

The person running the CLI or the local dashboard.
They own the Hetzner account and the API token when they use Hetzner.
They provision, tear down, mint tokens, and edit `operator.env` on this machine.
They are not a caller unless they mint a token and use it.

The dashboard is delivery, not a domain type.
Operator HTTP is delivery.
Neither is a hosted control plane.

## What does not exist yet

Backup and restore-drill entities are Phase C.
Do not add them to `src/domain/` now.
Object storage belongs in Phase B when that ticket is in progress, not before.
