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
Phase A does not create callers.
The operator mints tokens for tests and for themselves.

## Token

A signed JWT.
Claims that matter: `sub` (caller id) and `role` (the database role PostgREST switches to).
Phase A trusts tokens.
Phase A does not issue them through a login flow.
The operator command `mint-token` exists so the acceptance test and the operator can obtain a token.

A missing token is not a caller.
A token with a broken signature is not a caller.
Both get nothing from the API.

## Operator

The person running the CLI.
They own the Hetzner account and the API token.
They provision, tear down, and mint tokens.
They are not a caller unless they mint a token and use it.

## What does not exist yet

Backup, bucket, object, session, and dashboard entities are Phase B or C.
Do not add them to `src/domain/` now.
