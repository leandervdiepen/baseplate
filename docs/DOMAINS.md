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

Two projects on one machine share no secrets and no Docker volumes.
They do share ports, because **one stack runs at a time**.
Every project gets 8080, 5432, and 8788 unless the operator names otherwise, and `up` refuses while another project's stack holds them.
`up --replace` stops that one and takes over.

Which stack is running is not written down anywhere.
Docker holds it, in a label on the containers, so nothing has to stay in step with reality.
A stack whose label does not say where it came from still counts as running: it is holding the
ports either way, and forgetting it would make the one-at-a-time rule blind to exactly the stacks
it can explain least.

The studio serves one project and can be pointed at another without being restarted.
Switching is a change of view: it does not stop one stack or start another, because those take
minutes and should be asked for.
The list of projects to switch between is the operator's own, kept in `~/.baseplate/projects.json`,
and `init` and opening the studio both add to it.

The studio is delivery, not a domain type.
Operator HTTP is delivery.
Neither is a hosted control plane.

## Stopping and destroying

Different things, and never the same command.

`down` stops the containers. The volumes, the data, and any server stay.
`destroy` removes the volumes and the server with them, and asks first.

## Bucket

A named place for objects, made by the operator like a table is.
An app never makes one.

`private` means a caller sees only the objects they put there.
`public` means anyone holding a token may read, and still only the owner may
write over an object or remove it.

A bucket is one flat namespace: a key is taken or it is not, whoever took it.
Someone who is refused a key learns that it exists, and nothing else.

## Object

Bytes at a key in a bucket, with a row in `storage.objects` that says who owns
them.

The row is claimed before a byte is written, so being refused a key cannot
destroy what was behind it.
A blob with no row is unreachable, and is swept.

Invariant: an object key never climbs out of its bucket. No `..`, no leading
slash, no control characters.

## Backup

A dump of the operator's database, sealed, with a record of when it was taken,
how big it was, and where it went.

The record lives in the database next to the schema history.
The bytes live wherever the operator said, and if they said nowhere, on the same
machine, which is stated plainly rather than counted as safety.

## Restore drill

Proof that a backup restores. Not a check that a file exists: the whole chain
backwards, from the destination, through the seal, into a database of its own,
counting the tables and rows that came back.

A backup nobody has restored is a hope.
