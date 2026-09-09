# Baseplate

A complete Postgres backend you run in your own account.

Baseplate gives a small app its database, HTTP API, email and password auth, file storage, and encrypted backups in two commands.
It runs locally with Docker or on a small Hetzner VM with automatic DNS and TLS.
There is no hosted Baseplate control plane between you and your data.

[![CI](https://github.com/leandervdiepen/baseplate/actions/workflows/ci.yml/badge.svg)](https://github.com/leandervdiepen/baseplate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@diepen/baseplate)](https://www.npmjs.com/package/@diepen/baseplate)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

> **Verified:** the packaged `0.1.0` release is installed into an empty project and attacked by the full acceptance suite on every commit.
> On 8 September 2026, the same suite passed against a real CX23 server at `baseplate.hanaflo.org`, including TLS, row and object isolation, password recovery, an encrypted backup, a destructive restore, and row-level security after recovery.

## Start locally

You need Node 22 or newer and Docker.

```bash
mkdir my-backend && cd my-backend && mkdir src
npm init -y
npm install @diepen/baseplate@0.1.0

npx baseplate init
npx baseplate up
```

`init` writes one private `baseplate.env` with secrets generated for this project.
`up` starts the stack and prints the API URL.

Create a table and generate types from the database that is actually running:

```bash
npx baseplate schema add-table notes --column title:text
npx baseplate types > src/database.ts
```

```ts
import { createClient } from "@diepen/baseplate/client";
import type { Database } from "./database.ts";

const client = createClient<Database>("http://127.0.0.1:8080");

const { error } = await client.auth.signUp({ email, password });
await client.from("notes").insert({ title: "hello" });

const { data } = await client
  .from("notes")
  .select("id,title")
  .order("title")
  .limit(20);
```

`data` contains this user's notes and nobody else's.
The client did not add an ownership filter because Postgres enforced it.

Every client call returns `{ data, error }`.
A failed request is a value to render, not an exception your UI has to catch.

```bash
npx baseplate dashboard
npx baseplate down
```

The dashboard stays on `127.0.0.1`.
Stopping the stack keeps its data.

## What is included

| Capability | What Baseplate provides |
| --- | --- |
| **Database** | Postgres 16, reachable on loopback for `psql`, Drizzle, and other database tools. |
| **HTTP API** | PostgREST over your tables with filters, ordering, ranges, and pagination. |
| **Row security** | RLS enabled before a table takes its first row, with private, shared, and public read modes. |
| **Auth** | Signup, email confirmation, login, refresh-token rotation, logout, and password recovery under `/auth/*`. Credential endpoints are rate limited. |
| **Files** | Private or readable buckets, streamed uploads, per-user object access, and expiring signed URLs. |
| **Backups** | Scheduled `pg_dump`, streaming AES-256-GCM encryption, retention, restores, and scheduled restore drills. |
| **Studio** | Local management for tables, rows, access rules, users, files, backups, logs, and settings. |
| **Deployment** | Terraform creates a Hetzner VM, firewall, A and AAAA records, then Caddy obtains and renews TLS. |
| **Automation** | A CLI for people and an MCP server exposing the same operator actions to agents. |

## Security lives in Postgres

Baseplate has no anonymous project key or public service key.
`JWT_SECRET` stays on the server.

Every managed table gets:

- an `owner_id uuid not null` column;
- a Postgres RLS policy matching `owner_id` to the JWT `sub` claim;
- a `BEFORE INSERT` trigger that stamps the authenticated caller, so a client cannot choose another owner;
- grants for the narrow application roles only.

Tables in `public` that Baseplate has not adopted are locked down automatically.
Policies and grants are reapplied on every start, including after a restore.

Two users can call the same endpoint with no user filter and receive different answers:

```ts
await post("/notes", alice.token, { title: "alice only" });

expect(await get("/notes", alice.token)).toHaveLength(1);
expect(await get("/notes", bob.token)).toHaveLength(0);
```

That is the central design decision: authorization is a database invariant rather than a convention every application query must remember.

### Read modes

Writes always belong to one authenticated user.
Each table chooses how broadly rows may be read:

| Mode | Who can read | Good for |
| --- | --- | --- |
| `private` | The owner | Notes, drafts, personal records |
| `shared` | Any signed-in user | Comments, team boards, feeds |
| `public` | Anyone | Published posts, prices, tags |

```bash
npx baseplate schema add-table posts --column title:text --access shared
npx baseplate schema set-access posts public
```

Changing access is one database transaction and applies immediately.

## Bring an existing schema

Baseplate can own schema changes:

```bash
npx baseplate schema add-table boards --column name:text
npx baseplate schema history
```

It can also protect tables created by Drizzle or another migration tool:

```bash
npx baseplate schema adopt-table boards
```

Give the table an `owner_id uuid not null` column first.
Adoption records the table, creates its policies and owner trigger, and grants the application role in one transaction.

The [`examples/kanban`](examples/kanban) app shows auth, protected tables, and card attachments together.

## File storage

```bash
npx baseplate storage add-bucket avatars
```

```ts
await client.storage.from("avatars").upload("me.png", file);
await client.storage.from("avatars").list();

const { data: url } = await client.storage
  .from("avatars")
  .createSignedUrl("me.png", 3600);
```

Object metadata is protected by Postgres RLS.
The bytes sit behind a private storage service and stream through the API without being buffered in memory.
Knowing another user's object key still returns 404.

The bundled object store is suitable for local work and one-node deployments.
Set `STORAGE_*` to use Hetzner Object Storage, Backblaze B2, AWS S3, or another S3-compatible service.

## Backups that prove they restore

```bash
npx baseplate backup now
npx baseplate backup drill
npx baseplate backup drills
npx baseplate restore <id>
```

`pg_dump` writes a compressed custom-format dump.
Baseplate streams it through AES-256-GCM, records its SHA-256 digest, and sends the sealed file to the configured destination.
The backup is never sized by the server's memory.

A restore drill opens the newest backup into a scratch database and counts the tables, rows, and users that came back.
Restoring the live database is CLI-only and asks for the project name before replacing data.

If `BACKUP_S3_*` is blank, encrypted dumps stay on the database server.
The studio labels that honestly as a local copy, not an off-server backup.

## Deploy to Hetzner

You need a Hetzner project with:

1. A read-write project API token.
2. A DNS zone delegated to Hetzner.
3. An SSH public key uploaded to the project, with its private key available locally.

Open Settings in the local dashboard, select Hetzner, and save the token.
Baseplate reads the available regions, DNS zones, and SSH keys from that project so you can select them instead of copying identifiers.

Set a hostname under the selected zone, then start the stack.
Terraform creates:

- one `cx23` server running Ubuntu 24.04;
- a firewall exposing only SSH, HTTP, and HTTPS;
- A and AAAA records for the hostname.

Baseplate waits for cloud-init, syncs the stack over SSH, starts the containers, and validates the public hostname certificate against the server it created.

The Hetzner token never leaves your computer.
The remote server receives only the secrets it needs to run Postgres, auth, storage, backups, and any SMTP or external S3 services you configured.
`.baseplate/stack.env` is the exact boundary.

Cloud deployments do not expose Postgres, the dashboard, or the development inbox.
Configure `SMTP_*` before real users need confirmation or recovery emails.
Configure `BACKUP_S3_*` before treating the server as production data storage.

See [`infra/README.md`](infra/README.md) for the infrastructure boundary and teardown behavior.

## Local studio

```bash
npx baseplate dashboard
```

The studio manages tables, rows, RLS modes, users, files, backups, logs, and configuration.
It binds to loopback and rejects cross-site requests.
Cloud credentials remain in the project's local `baseplate.env` and are never returned to the browser after saving.

Run `init` in multiple directories and the project switcher can move between them without restarting the studio.
Only one local stack runs at a time.

## Agents and MCP

```bash
npx baseplate mcp
```

The MCP server speaks stdio JSON-RPC and exposes the operator actions that make sense for an agent.
Destructive tools require `confirm: true`.
It operates the backend but does not query application rows; application code uses the typed client.

```json
{
  "mcpServers": {
    "baseplate": {
      "command": "npx",
      "args": ["baseplate", "mcp"]
    }
  }
}
```

Agents building an app can load [`skills/baseplate-app/SKILL.md`](skills/baseplate-app/SKILL.md).
The same skill ships inside the npm package.

## What the release tests prove

`npm run test:artifact` packs the npm tarball, installs it into an empty project, starts that installed copy, and runs the acceptance suite against it.

The suite proves:

- two JWT subjects cannot read or mutate each other's rows;
- private, shared, and public read modes do not widen writes;
- missing and forged tokens are rejected;
- signup, login, refresh rotation, logout, and password reset work end to end;
- two users cannot read, replace, or delete each other's objects;
- an encrypted backup can replace the live database;
- pre-backup rows and users return, post-backup rows disappear, and RLS still isolates callers after the restore.

The live Hetzner drill ran these same checks through the deployed API and a loopback-only test inbox.

## Deliberate scope

Baseplate is for one developer running small applications on one node.
It is intentionally smaller than a managed application platform.

Choose Supabase when you need realtime subscriptions, edge functions, vectors, social login, point-in-time recovery, replicas, or a hosted team dashboard.
Choose Baseplate when you want the ordinary backend pieces together, a short operational path, and ownership of the server and data.

Current limits:

- Rows have one owner.
  Shared and public modes widen reads, never writes.
- One node, with no replica or automatic failover.
- Email and password auth only.
  There is no OAuth, magic-link login, or MFA.
- No metrics or external failure alerts yet.
- No point-in-time recovery.
- S3 uploads use one signed request, so the practical object limit is 5 GB until multipart upload is implemented.

## Commands

```text
init      up        down      destroy   dashboard
logs      mcp       tables    types     schema
storage   backup    restore   users     mint-token
```

Run `npx baseplate --help`, or run a command without arguments for its focused help.

## Documentation

| Document | Use it for |
| --- | --- |
| [`sdk/README.md`](sdk/README.md) | Auth, typed queries, filters, storage, and Playwright setup |
| [`skills/baseplate-app/SKILL.md`](skills/baseplate-app/SKILL.md) | Building against Baseplate with an agent |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, boundaries, state, and dependency direction |
| [`docs/DOMAINS.md`](docs/DOMAINS.md) | Product concepts and invariants |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Code, secrets, tests, and studio conventions |
| [`SECURITY.md`](SECURITY.md) | Threat model and vulnerability reporting |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Development workflow and quality checks |

## Contributing

```bash
git clone https://github.com/leandervdiepen/baseplate.git
cd baseplate
npm install
./scripts/dev init
./scripts/dev up

npm run lint
npm run lint:arch
npm run typecheck
npm test
npm run test:integration
npm run test:acceptance
npm run test:artifact
npm run pack:check
```

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE) © Leander van Diepen
