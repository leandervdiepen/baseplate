# Baseplate

Baseplate is a platform you run on top of your own Hetzner account.
You bring the API token (BYOK).
Baseplate has no cloud account, no hosted control plane, and no bill of its own.
Hetzner invoices you for the server.

It is not a competitor to managed platforms (Supabase, Firebase, Neon, and the rest), and feature parity with them is a non-goal.
It exists so a solo developer who runs a handful of small apps can understand and own the database, the API, TLS, and the access rules, because those things live in this repo.

Destroying the server and rebuilding it from these files is a normal operation.

## Try it

```bash
./scripts/provision
npm run test:acceptance
./scripts/dashboard
```

`./scripts/provision` copies `operator.env.example` if needed and starts Postgres, PostgREST, auth, and Caddy.
Default `TARGET=local` is Docker on this machine.
The API URL it prints is what your app talks to (locally `http://127.0.0.1:8080`).

`./scripts/dashboard` opens the operator studio at http://127.0.0.1:8788.
It never binds off loopback.
Secrets stay in `operator.env` on this machine.

`npm run test:acceptance` is the definition of done: two minted tokens and two signed-up users, one endpoint, disjoint rows.
No token and a tampered token get nothing.
The database does the filtering.

Set `TARGET=hetzner` and paste your Hetzner API token, DNS token, zone, and SSH key name into `operator.env` to create one server in your account.
That path needs a domain you already own as a Hetzner DNS zone.

## Connect an app

There is no public key and no anon key.
`JWT_SECRET` stays on the server.
Signup and login are public HTTP on the stack.
After login the client holds a user JWT (`sub` is the user id, `role` is `app_user`).

The typed client lives in this repo at `sdk/`.
It is not published to npm.

```json
{
  "dependencies": {
    "@baseplate/client": "file:../baseplate/sdk"
  }
}
```

```ts
import { createClient, type Database } from "@baseplate/client";

const client = createClient<Database>("http://127.0.0.1:8080");
await client.auth.signUp({
  email: "you@example.com",
  password: "a-long-password",
});
const { data, error } = await client.from("items").select();
await client.from("items").insert({ body: "hello" });
```

`POST /auth/login` is the same shape as signup.
Row-level security keeps each caller on their own `items` rows.

Refresh table types from a running API (anon cannot see tables, so this needs a caller JWT):

```bash
BASEPLATE_TOKEN=$(./scripts/mint-token --sub 11111111-1111-4111-8111-111111111111) npm run sdk:types
```

`./scripts/mint-token --sub UUID` is for operators and tests.
Apps should sign up with email and password.

## What you get

- Postgres with row-level access driven by the JWT `sub`
- Email + password login on `POST /auth/signup` and `POST /auth/login`
- HTTP API on localhost (PostgREST and auth behind Caddy)
- A typed in-repo client (`sdk/`)
- A local operator studio (`./scripts/dashboard`) for tables, schema, auth, logs, and settings
- `./scripts/provision` / `teardown` / `mint-token`

Hetzner (`TARGET=hetzner`) adds a VM, firewall, DNS A record, and TLS in **your** account.
It is not required to work locally.

## Docs

| File | What it is |
| --- | --- |
| `docs/PRD.md` | Product, phases, done criteria, DX bar |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits |
| `docs/COMPONENTS.md` | Dashboard UI rules and Paper source |
| `sdk/README.md` | App client: install path, auth, typed queries |
| `AGENTS.md` | Short rules for the next agent |

## Status

Phase B is the active scope: local operator studio, email/password login, in-repo client.
Phase A local is proven.
Object storage (DPN-154) and a policy editor (DPN-152) are still open.
Hetzner live provision waits on the operator having a DNS zone (DPN-146).
