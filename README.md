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

`./scripts/dashboard` opens the local operator studio at http://127.0.0.1:8788.
It never binds off loopback.
Secrets stay in `operator.env` on this machine.

`./scripts/provision` copies `operator.env.example` if needed and starts the stack.
Default `TARGET=local` is Docker on this machine.
Set `TARGET=hetzner` and paste your Hetzner API token, DNS token, zone, and SSH key name into `operator.env` to create one server in your account.

When it finishes it prints the API URL.
Apps connect with URL + email/password (no public key):

```ts
import { createClient, type Database } from "@baseplate/client";
const client = createClient<Database>("http://127.0.0.1:8080");
await client.auth.signUp({ email: "you@example.com", password: "a-long-password" });
```

Depend on the client from this repo (`file:../baseplate/sdk`). It is not published to npm.
The acceptance scripts are the definition of done: two tokens and two signups, one endpoint, disjoint rows.
No token and a tampered token get nothing.
The database does the filtering.

## What you get (Phase A, local)

- Postgres with row-level access driven by a signed token
- Email + password login on `/auth/signup` and `/auth/login`
- An HTTP API on localhost (PostgREST and auth behind Caddy)
- `./scripts/provision` / `teardown` / `mint-token`

Hetzner (`TARGET=hetzner`) adds a VM, firewall, DNS A record, and TLS in **your** account.
That path needs a domain you own as a Hetzner DNS zone.
It is not required to prove Phase A locally.

## Docs

| File | What it is |
| --- | --- |
| `docs/PRD.md` | Product, phases, done criteria, DX bar |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits |
| `docs/COMPONENTS.md` | Dashboard UI rules and Paper source |
| `AGENTS.md` | Short rules for the next agent |

## Status

Phase B is the active scope: a local operator dashboard with one-command DX.
Phase A local is proven.
Hetzner live provision waits on the operator having a DNS zone (DPN-146).
