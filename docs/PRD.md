# Product

Baseplate is a backend a solo developer installs, runs, and owns.
It gives them a Postgres database, an HTTP API over it with per-user row access, email and password login, automatic TLS, and a local studio for tables, policies, logs, tokens, and settings.

It runs on their laptop, or on a server in their own Hetzner account (bring your own key).
Baseplate has no cloud account and no hosted control plane.
Hetzner bills the operator.

Baseplate is not a competitor to managed platforms.
Feature parity with them is a non-goal.

## Who it is for

One developer running a handful of small apps who wants to understand and own their backend.

## The rule that shapes the product

**An operator manages a running system, never a codebase.**

They install a version of Baseplate and point it at a directory.
That directory holds their config, their secrets, and their state, and nothing else.

Their tables live in their database.
A schema change is a transaction against that database, recorded there.
There is no file to commit, no migration to merge, and no fork of Baseplate to maintain.

Upgrading is installing a different version.

## DX bar

Every capability is one command or one primary button.
Agents get one tool.
If a step needs a human to read a wiki, it is not done.
If a step needs an agent to read a wiki, it is not done.
If a step needs a human to edit a file Baseplate ships, it is a bug.

The studio is local (127.0.0.1).
Each operator's keys, zone, and hostname live only on their machine.
A first run must work with no domain and no Hetzner account.
Hetzner is an extra path that asks for a domain they already own.

Two Baseplate projects on one machine must not collide.

## What is built

### The substrate

One command turns an empty directory into a working HTTP API backed by Postgres, where a row is written only by whoever owns it and each table says who may read it.

```
npx @diepen/baseplate init
npx @diepen/baseplate up
```

Locally that is Docker on the operator's machine.
On Hetzner it is one server in their account, created with their API token, with a hostname and a certificate.

Done, and proven: `npm run test:acceptance`.
Two tokens, one endpoint, disjoint rows.
A missing token and a tampered token get nothing.
The database does the filtering.

### The services

- **Schema.** Tables, columns, renames, and drops from the studio, the CLI, or MCP. Each is one transaction: the DDL, the row access policy, the owner trigger, the grants, and a history entry. A table cannot exist unprotected.
- **Auth.** Email and password on the stack. Short-lived access tokens with `exp`, single-use refresh tokens that can be revoked, both lifetimes configurable in the studio.
  Password reset and email verification over mail: a dev inbox ships in the local stack, production names an SMTP server.
  Credential endpoints are rate limited.
  The studio's Auth view lists every account and can add, impersonate, reset, revoke, and delete one.
- **The client.** `@diepen/baseplate/client`. Typed queries with the filters an app needs, sessions that persist and refresh themselves. It never filters rows; the database does.
  The package publishes `skills/baseplate-app/SKILL.md` for agents writing apps.
- **Object storage.** Buckets the operator makes, objects an app puts in them. An object is a row with bytes attached and is guarded the same way: private buckets show a caller only their own, public ones are readable by anyone signed in and writable only by the owner. Signed links for what a browser must fetch without a header.
- **Backups.** A dump on a schedule, sealed with a key from the operator's own config, sent to any S3-compatible bucket they name. On its own schedule it restores one into a scratch database and counts what came back, and the studio leads with that date.
- **The studio.** Tables with their rows, schema, and row security on one page; storage; backups; auth; logs; settings. On 127.0.0.1.
- **Operator MCP.** The agent-native operator surface: stdio JSON-RPC, spawned as `baseplate mcp` in the local project, same use cases as the CLI and the studio.
  It never binds a port.
  It is not a hosted control plane.
  App row queries are not MCP tools; apps use `@diepen/baseplate/client`.

### Still open

- A live Hetzner provision against a real domain
- OAuth, magic links, and MFA are not planned; email and password is the whole auth story

## Out

- Any hosted Baseplate URL that stores other people's Hetzner keys
- A Baseplate-owned cloud account or domain
- Buying a domain for the operator
- Realtime, multi-node, Kubernetes

If a task feels like it belongs to an out item, stop and ask.

## Done

An operator who has never read a wiki can:

1. Run two commands in an empty directory and have an API.
2. Open the studio, make a table, and see it protected.
3. Sign up two users from an app and watch each see only their own rows.
4. Save Hetzner keys when they have a domain, pass the readiness checks, and provision to their account from the same screen.

`npm run test:acceptance` still passes.
The studio does not filter rows in the browser. RLS stays the gate.

## How it is built

Compose mature pieces.

| Need | Piece |
| --- | --- |
| HTTP API over Postgres | PostgREST |
| Row access | Postgres row-level security |
| TLS | Caddy (automatic Let's Encrypt on a real hostname) |
| Processes on one machine | Docker Compose |
| Cloud server, firewall, DNS | Hetzner Cloud + Hetzner DNS, declared in Terraform, using the operator's API token |
| Hetzner account | The operator's. Baseplate holds none. |
| Tokens PostgREST trusts | JWT HS256, `sub` is the user id, `role` is the database role |
| User login | `stack/auth/`, public `/auth/*`, no anon or public key |
| Schema and access state | The operator's database, in schema `baseplate` |
| Object bytes | SeaweedFS on the compose network, or any S3 the operator points at |
| Backup destination | Any S3-compatible bucket. Hetzner Object Storage, B2, S3 |
| App client | `@diepen/baseplate/client` |
| Studio | React + Tailwind, local only |
| Operator MCP | Stdio JSON-RPC via `baseplate mcp` in the project. Never binds a port. |
| Distribution | npm. Installing a version is how you pin one. |

The interesting work is the access model and the operator experience, not reimplementing those pieces.
