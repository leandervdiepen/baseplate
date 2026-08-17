# Product

Baseplate is a platform a solo developer runs on top of their own Hetzner account.
The operator brings the Hetzner API token (BYOK).
Baseplate has no cloud account and no hosted control plane.
Hetzner bills the operator for the server.

It gives them a Postgres database, an HTTP API over that database with per-user row access, automatic TLS, and (in this phase) a local dashboard for tables, policies, logs, tokens, and operator settings.

The whole stack is described in files in this repo.
Destroying the server and rebuilding it from those files is a normal operation, not a recovery scenario.

Baseplate is not a competitor to managed platforms.
Feature parity with them is a non-goal.

## Who it is for

One developer running a handful of small apps who wants to understand and own their backend.

## DX bar

Every capability is one command or one primary button.
If a step needs a human to read a wiki, it is not done.
The dashboard is local (127.0.0.1).
Each operator's keys, zone, and hostname live only on their machine.
A first run on `TARGET=local` must work with no domain and no Hetzner account.
Hetzner is an extra path that asks for a domain the operator already owns.

## Phases

Phase B is the active scope.
Do not build Phase C.
Do not add a hosted control plane.

### Phase A — the substrate (local proven)

One command turns an empty machine into a working HTTP API backed by Postgres, where each caller sees only their own rows.

Locally that machine is Docker on the operator's laptop (`TARGET=local`, the default).
The API is HTTP on port 8080.
On Hetzner (`TARGET=hetzner`) it is one server in the operator's account, created with their API token, with a hostname and a certificate.
Hetzner provision is implemented but not proven live until the operator has a DNS zone (DPN-146).

Phase A done (local): `./scripts/provision` then `npm run test:acceptance`.
Two tokens, one endpoint, disjoint rows.
A missing token and a tampered token get nothing.
The database does the filtering.

### Phase B — the services (active)

A local operator dashboard (Supabase-like table studio) plus auth that issues the tokens Phase A already trusts, and object storage whose access rules mirror the database.

The dashboard does not replace PostgREST.
Callers still hit the API.
The dashboard is how the operator sees tables, schema, policies, logs, and their own BYOK settings.

### Phase C — the proof

Encrypted backups to a second provider.
A restore drill that runs on a schedule in CI: provision, seed, destroy, restore, assert the data is intact.
The rest of the operator CLI.

## Phase B scope

In:

- `./scripts/dashboard` opens a UI on 127.0.0.1
- First-run: local stack with generated secrets, no domain required
- Settings that write `operator.env` on this machine (BYOK keys never leave the process)
- Provision and teardown from that UI (same use cases as the CLI)
- Table browser over PostgREST, with the caller JWT visible so RLS is obvious
- Schema map of declared tables, columns, keys, and owner columns
- Policy editor in product language, persisted in the declared stack
- Log viewer for the running target
- Auth: email + password on the stack (`/auth/signup`, `/auth/login`) issues those JWTs. No public key. `JWT_SECRET` stays on the server.
- In-repo typed client in `sdk/` (`file:` dependency, not an npm cloud product)
- Object storage with owner-scoped rules
- Visuals from the Paper file; tokens by role in `tokens.css`

Out:

- Any hosted Baseplate URL that stores other people's Hetzner keys
- A Baseplate-owned cloud account, domain, or npm registry
- Buying a domain for the operator
- Backups and restore drills (Phase C)
- Realtime
- Multi-node
- Kubernetes

If a task feels like it belongs to an out item, stop and ask.

## Phase B done

An operator who has never read a wiki can:

1. Run one command and see the dashboard.
2. Stay on local, provision, sign up as two users, and browse `items` as those callers.
3. Save Hetzner keys locally when they have a domain, then provision to their account from the same UI.

`two-token.sh` and `signup-login.sh` still pass.
The dashboard does not filter rows in the browser.
RLS stays the gate.

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
| Tokens Phase A trusts | JWT HS256, `sub` is the user id, `role` is the database role |
| User login | `stack/auth/` email + password, public `/auth/*`, no anon/public key |
| App client | `sdk/` in this repo, typed `createClient<Database>(url)` |
| Operator UI | React + Tailwind + shadcn, local only |
| Operator actions from the UI | Same use cases as the CLI, behind localhost HTTP |

The interesting work is the access model and the operator experience, not reimplementing those pieces.
