# Baseplate

A Postgres database, an HTTP API over it with per-user row access, email and password login, and a local studio to run it all.
You install a version and point it at your own machine or your own Hetzner account.

Baseplate has no cloud account, no hosted control plane, and no bill of its own.
Hetzner invoices you for the server.

It is not a competitor to managed platforms (Supabase, Firebase, Neon, and the rest), and feature parity with them is a non-goal.
It exists so a solo developer who runs a handful of small apps can own the database, the API, TLS, and the access rules.

## Start

You need Docker running. Nothing else.

```bash
mkdir my-backend && cd my-backend
npx @diepen/baseplate init
npx @diepen/baseplate up
```

`init` writes `baseplate.env` with secrets generated for this project alone.
`up` starts Postgres, the API, auth, object storage, backups, and Caddy, then prints the API URL your app talks to (locally `http://127.0.0.1:8080`).

That directory holds your config, your secrets, and your state.
It is yours, and Baseplate never writes anything else into it.

Two projects on one machine share no secrets and no volumes. They do share
ports, because one stack runs at a time: `up` refuses while another project's
stack holds them and names the directory it is in, and `up --replace` stops that
one and takes over.

Name the ports yourself if you would rather: `init --port 9100 --postgres-port 5599 --dashboard-port 9788`.

`down` stops the stack and keeps your data. `destroy` deletes it, and asks you
to type the project's name first.

## Make a table

A fresh Baseplate has no application tables.
You make them:

```bash
npx @diepen/baseplate schema add-table notes --column title:text --column pinned:boolean:null
```

That runs one transaction against your database: the `CREATE TABLE`, the row access policy, the owner trigger, the grants, and an entry in `baseplate.schema_history`.
There is no file to commit and nothing to keep in step.

A table made this way is protected before it can take its first row.
A caller only ever sees rows whose `owner_id` matches the `sub` of their token.

```bash
npx @diepen/baseplate tables            # what you have
npx @diepen/baseplate schema            # every change it takes
```

Renaming, dropping, and adding columns work the same way.
So does the studio, if you would rather click:

```bash
npx @diepen/baseplate dashboard         # 127.0.0.1 only; prints its URL
```

## Connect an app

There is no public key and no anon key.
`JWT_SECRET` stays on the server.
Signup and login are public HTTP; after login the client holds a user JWT whose `sub` is the user id.

Install the package in your app and generate types from the database you just made:

```bash
npm install @diepen/baseplate
npx @diepen/baseplate types > src/database.ts
```

```ts
import { createClient } from "@diepen/baseplate/client";
import type { Database } from "./database.ts";

const client = createClient<Database>("http://127.0.0.1:8080");
await client.auth.signUp({ email, password });

await client.from("notes").insert({ title: "hello" });

const { data, error } = await client
  .from("notes")
  .select("id,title")
  .eq("pinned", true)
  .order("title")
  .limit(20);

await client.from("notes").update({ title: "renamed" }).eq("id", id);
await client.from("notes").delete().eq("id", id);
```

Because the types come from your live database, an unknown table or column is a compile error rather than a 400 at runtime.
Regenerate after a schema change.

Sessions persist and refresh themselves before the access token expires.
Access tokens are short-lived and refresh tokens are single use; both lifetimes are yours to set in the studio.

Row-level security keeps each caller on their own rows.
The client never filters: every filter becomes a query the database answers.

Full client reference: [`sdk/README.md`](sdk/README.md).

## Schema as code, if you prefer it

Point drizzle-kit at the database like you would at any Postgres.
`drizzle-kit pull` reads what is there; `drizzle-kit push` applies changes.

A table Baseplate did not create is locked down until you hand it over, so nothing appears on the API by accident:

```bash
npx @diepen/baseplate schema adopt-table boards
```

That records the table, writes its access policy, adds the trigger that stamps `owner_id` from the caller's token, and grants the app role, in one transaction.
Give every table an `owner_id uuid not null` column and adopt it after each push.

[`examples/kanban`](examples/kanban) is a working board built this way: drizzle for the schema, Baseplate for login and row access.

## Store files

A bucket is yours to make, like a table. An app puts objects in one and only
ever sees its own, decided by the same row-level security that decides rows.

```bash
npx @diepen/baseplate storage add-bucket avatars
```

```ts
await client.storage.from("avatars").upload("me.png", file);
await client.storage.from("avatars").list();
const { data: url } = await client.storage.from("avatars").createSignedUrl("me.png", 3600);
```

A signed link is what an `<img src>` can follow, since it cannot send a header.
It covers one object and expires.

`add-bucket --public` makes a bucket anyone signed in can read, where only the
caller who put an object there can replace or remove it.

The bytes sit in a store on the compose network, never published. Point
`STORAGE_ENDPOINT` at Hetzner Object Storage, B2, or S3 and nothing else changes.

## Back it up

A dump runs on a schedule, sealed with a key generated for your project, and
goes wherever you point `BACKUP_S3_*`. Name nothing and it stays on the same
machine as the database, which is better than nothing and is not a backup.

```bash
npx @diepen/baseplate backup now
npx @diepen/baseplate backup drills
npx @diepen/baseplate restore <id>
```

On its own schedule it restores the newest backup into a scratch database and
counts what came back, because a backup nobody has restored is a hope. The
studio leads with that date rather than with a list of files.

Restoring replaces the live database, so it is a command and it asks you to type
the project's name first.

## Go to a server

Set the target to Hetzner in the studio's Settings and Baseplate creates a VM, a firewall, a DNS record, and a TLS certificate in **your** account, from your own API tokens.
Those tokens stay on your machine; only the database and JWT secrets are sent to the server.

Paste the two tokens, press **Check my account**, and the region, SSH key, and DNS zone become lists read from your own account rather than three names to type from memory.
The hostname is then just the label in front of the zone you picked.

This is not required to work locally, and local needs no domain and no cloud account.

## What you get

- Postgres with row-level access driven by the JWT `sub`
- Email and password login on `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- An HTTP API over your tables (PostgREST and auth behind Caddy)
- A typed client with the queries an app needs
- Object storage with the same per-caller rules, and signed links
- Scheduled encrypted backups, and a drill that proves one restores
- A local studio: tables with their rows, schema and row security on one page, storage, backups, auth, logs, settings
- `init`, `up`, `down`, `destroy`, `dashboard`, `schema`, `storage`, `backup`, `restore`, `tables`, `types`, `mint-token`

Run `npx @diepen/baseplate --help` for the whole list.

## Docs

| File | What it is |
| --- | --- |
| `sdk/README.md` | App client: install, auth, typed queries |
| `docs/PRD.md` | Product, phases, done criteria, DX bar |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits, studio UI |
| `CONTRIBUTING.md` | How to run it, and the rules a change is held to |
| `SECURITY.md` | What counts as a vulnerability, and where to send one |
| `AGENTS.md` | Short rules for the next agent |

## Status

The local path is proven end to end: install, init, up, make a table, sign up two users, and each sees only their own rows and their own files. `npm run test:acceptance` is that proof, and it runs in CI.

Hetzner is implemented and preflighted in the studio, but has not been run live against a real domain yet.

Not built: rate limiting, password reset, and email verification on auth. One node, so a restore is minutes of downtime rather than seconds. No metrics and no alert when a backup fails.
