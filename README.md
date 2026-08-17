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
```

`./scripts/provision` copies `operator.env.example` if needed and starts the stack.
Default `TARGET=local` is Docker on this machine.
Set `TARGET=hetzner` and paste your Hetzner API token, DNS token, zone, and SSH key name into `operator.env` to create one server in your account.

When it finishes it prints the API URL.
The acceptance script is the definition of done: two tokens, one endpoint, disjoint rows.
No token and a tampered token get nothing.
The database does the filtering.

## What you get (Phase A)

- One server, declared in `infra/`, firewall closed except the ports the stack needs
- A hostname with a valid certificate that renews itself
- Postgres with row-level access driven by a signed token
- An HTTP API on the public internet (PostgREST)

## Docs

| File | What it is |
| --- | --- |
| `docs/PRD.md` | Product, phases, done criteria |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits |
| `docs/COMPONENTS.md` | UI rules. Skip until Phase B. |
| `AGENTS.md` | Short rules for the next agent |

## Status

Phase A is the active scope.
Phases B and C are listed in `docs/PRD.md` so the destination is visible.
They are not in this repo's current work.
