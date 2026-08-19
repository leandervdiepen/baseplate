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
`up` starts Postgres, PostgREST, auth, and Caddy, then prints the API URL your app talks to (locally `http://127.0.0.1:8080`).

That directory holds your config, your secrets, and your state.
It is yours, and Baseplate never writes anything else into it.

Two projects on one machine share nothing: not ports, not volumes, not secrets.
`init` picks free ports for the API, Postgres, and the studio, so a second project comes up beside the first and both studios can be open at once.
Name them yourself when you care which: `init --port 9100 --postgres-port 5599 --dashboard-port 9788`.
A port you name is used or the command stops; only a port you left out is allowed to move.

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

## Go to a server

Set the target to Hetzner in the studio's Settings and Baseplate creates a VM, a firewall, a DNS record, and a TLS certificate in **your** account, from your own API tokens.
Those tokens stay on your machine; only the database and JWT secrets are sent to the server.

This is not required to work locally, and local needs no domain and no cloud account.

## What you get

- Postgres with row-level access driven by the JWT `sub`
- Email and password login on `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- An HTTP API over your tables (PostgREST and auth behind Caddy)
- A typed client with the queries an app needs
- A local studio for tables, schema, policies, auth, logs, and settings
- `init`, `up`, `down`, `dashboard`, `schema`, `tables`, `types`, `mint-token`

Run `npx @diepen/baseplate --help` for the whole list.

## Docs

| File | What it is |
| --- | --- |
| `sdk/README.md` | App client: install, auth, typed queries |
| `docs/PRD.md` | Product, phases, done criteria, DX bar |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits, studio UI |
| `AGENTS.md` | Short rules for the next agent |

## Status

The local path is proven end to end: install, init, up, make a table, sign up two users, and each sees only their own rows.
Hetzner is implemented and preflighted in the studio, but has not been run live against a real domain yet.
Object storage is still open.
