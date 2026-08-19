# Baseplate

A Postgres database, an HTTP API over it with per-user row access, email and password login, and a local studio to run it all.
You install a version and point it at your own machine or your own Hetzner account.

Baseplate has no cloud account, no hosted control plane, and no bill of its own.
Hetzner invoices you for the server.

It is not a competitor to managed platforms (Supabase, Firebase, Neon, and the rest), and feature parity with them is a non-goal.
It exists so a solo developer who runs a handful of small apps can own the database, the API, TLS, and the access rules.

## Start

```bash
mkdir my-backend && cd my-backend
npx @diepen/baseplate init
npx @diepen/baseplate up
npx @diepen/baseplate dashboard
```

`init` writes `baseplate.env` with secrets generated for this project.
`up` starts Postgres, PostgREST, auth, and Caddy, and prints the API URL your app talks to (locally `http://127.0.0.1:8080`).
`dashboard` opens the studio at http://127.0.0.1:8788, which never binds off loopback.

That directory holds your config, your secrets, and your state.
It is yours, and Baseplate never writes anything else into it.

## Your tables live in your database

A fresh Baseplate has no application tables.
You make them, from the studio or from the CLI:

```bash
npx @diepen/baseplate schema add-table notes --column title:text --column pinned:boolean:null
```

That runs one transaction against your database: the `CREATE TABLE`, the row access policy, the owner trigger, the grants, and an entry in `baseplate.schema_history`.
There is no file to commit and nothing to keep in step.
A table made this way is protected before it can take its first row: a caller only ever sees rows whose `owner_id` matches the `sub` of their token.

Renaming, dropping, and adding columns work the same way.
`npx @diepen/baseplate tables` lists what you have.

If you prefer schema as code in your app's repo, point drizzle-kit at the database like you would at any Postgres.
`drizzle-kit pull` reads what is there; `drizzle-kit push` applies changes.
Declare row access for anything you make that way by adding it to `baseplate.tables`.

## Connect an app

There is no public key and no anon key.
`JWT_SECRET` stays on the server.
Signup and login are public HTTP; after login the client holds a user JWT whose `sub` is the user id.

The typed client is in this package:

```json
{ "dependencies": { "@diepen/baseplate": "^0.4.0" } }
```

```ts
import { createClient } from "@diepen/baseplate/client";

const client = createClient("http://127.0.0.1:8080");
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

Sessions persist in `localStorage` and refresh themselves before the access token expires.
Access tokens are short-lived and refresh tokens are single use; both lifetimes are yours to set in the studio.

Row-level security keeps each caller on their own rows.
The client never filters: every filter becomes a query the database answers.

## What you get

- Postgres with row-level access driven by the JWT `sub`
- Email and password login on `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- An HTTP API over your tables (PostgREST and auth behind Caddy)
- A typed client with the queries an app needs
- A local studio for tables, schema, policies, auth, logs, and settings
- `init`, `up`, `down`, `dashboard`, `schema`, `tables`, `mint-token`

Set the target to Hetzner in Settings and Baseplate creates a VM, firewall, DNS record, and TLS certificate in **your** account.
It is not required to work locally.

## Docs

| File | What it is |
| --- | --- |
| `docs/PRD.md` | Product, phases, done criteria, DX bar |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits |
| `docs/COMPONENTS.md` | Studio UI rules and Paper source |
| `sdk/README.md` | App client: install, auth, typed queries |
| `AGENTS.md` | Short rules for the next agent |

## Status

The local path is proven end to end: install, init, up, make a table, sign up two users, and each sees only their own rows.
Hetzner is implemented and preflighted in the studio, but has not been run live against a real domain yet.
Object storage is still open.
