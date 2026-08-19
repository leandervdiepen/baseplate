# Domains

This is the product language and the rules for each concept.
Code uses these names.
If a name here and a name in code disagree, that is a bug.

Vendor names (Hetzner, PostgREST, Caddy, Docker, Terraform) are not domain types.
They belong in `infra/`, `stack/`, or `src/infrastructure/<system>/`.

## Stack

The running backend a caller talks to.
A stack has a name, a hostname, a caller role, and one database.

It deliberately does **not** have a list of tables.
Tables belong to the operator and live in their database, so nothing Baseplate ships can claim to know them.

`stack/compose.yaml`, `stack/Caddyfile`, `stack/auth/`, and `stack/migrate/` are how a stack runs.
`stack/platform/` is Baseplate's own schema inside it.

## Server

The machine the stack runs on.

Locally the server is the operator's Docker engine, addressed as `127.0.0.1`.
On Hetzner it is one VM in the operator's account (BYOK), with a public IPv4.

A server has an id, an IPv4 address, and a status (`pending` or `running`).

## Database

Postgres, one catalog, belonging to the operator.
It holds their tables and, in schema `baseplate`, the record of what those tables are and how they got that way.

A fresh stack has no application tables. The operator makes them.

## Table

A named relation with an owner column.
The owner column holds the caller's id.
Rows without an owner are not a thing we allow.

`baseplate.tables` is the registry: which tables exist and which column carries the owner.
It is read on every start to re-apply access, so it, not any file, is the truth.

## Schema change

One thing an operator does to their tables: create, drop, rename, add a column, drop a column.

Invariant: a created table carries an owner column, and its access policy exists before it can take a row.
Invariant: the owner column of a table cannot be dropped. Drop the table instead.
Invariant: a change names a table that exists, except a create, which names one that does not.
Invariant: identifiers are lowercase letters, digits, and underscores. Nothing else reaches SQL.

A change is applied as one transaction: the DDL, the registry row, the access rules, and a history entry.
If any part fails, none of it happened.

`baseplate.schema_history` is the record. It is the operator's, not this repo's.

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
The client receives a session after login.

## Session

What a signed-in user holds: an access token, a refresh token, and when the access token expires.

The access token is a JWT the API trusts and cannot be revoked, so it is short-lived.
The refresh token is opaque, stored only as a hash, single use, and revocable.
Spending one revokes it and issues a new pair; replaying a spent one gets nothing.
Both lifetimes are the operator's to set.

## Token

A signed JWT.
Claims that matter: `sub` (caller id), `role` (the database role PostgREST switches to), and `exp`.
The stack auth service and `mint-token` both produce tokens the API already trusts.
A token past its `exp` is not a caller.

A missing token is not a caller.
A token with a broken signature is not a caller.
Both get nothing from the API.

## Operator

The person who installed Baseplate and runs it against a directory of their own.
They own the Hetzner account and the API token when they use Hetzner.
They start and stop the stack, change their schema, mint tokens, and set their own config.
They are not a caller unless they mint a token and use it.

An operator maintains a running system. They never maintain Baseplate's code.

## Project

An operator's directory: `baseplate.env` and `.baseplate/`.
Created by `baseplate init`, with secrets generated for it alone.

Two projects on one machine share nothing: not ports, not Docker volumes, not secrets.
That includes the studio's own port, so an operator can have both projects open at once.

The studio is delivery, not a domain type.
Operator HTTP is delivery.
Neither is a hosted control plane.

## What does not exist yet

Backup and restore-drill entities are not started.
Do not add them to `src/domain/` before that work is in progress.
Object storage is the same.
