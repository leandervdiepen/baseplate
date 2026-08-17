# Product

Baseplate is a platform a solo developer runs on top of their own Hetzner account.
The operator brings the Hetzner API token (BYOK).
Baseplate has no cloud account and no hosted control plane.
Hetzner bills the operator for the server.

It gives them a Postgres database, an HTTP API over that database with per-user row access, automatic TLS, and (in later phases) authentication, file storage, backups, and a small dashboard.

The whole stack is described in files in this repo.
Destroying the server and rebuilding it from those files is a normal operation, not a recovery scenario.

Baseplate is not a competitor to managed platforms.
Feature parity with them is a non-goal.

## Who it is for

One developer running a handful of small apps who wants to understand and own their backend.

## Phases

Phase A is the active scope.
Do not build Phase B or C work.
Do not add abstractions whose only justification is a later phase.

### Phase A — the substrate (active)

One command turns an empty machine into a working HTTP API backed by Postgres, where each caller sees only their own rows.

Locally that machine is Docker on the operator's laptop (`TARGET=local`, the default).
The API is HTTP on port 8080.
On Hetzner (`TARGET=hetzner`) it is one server in the operator's account, created with their API token, with a hostname and a certificate.

### Phase B — the services

Authentication that issues the tokens Phase A already trusts.
Object storage with access rules that mirror the database rules.
A dashboard for browsing tables, editing policies, and reading logs.

### Phase C — the proof

Encrypted backups to a second provider.
A restore drill that runs on a schedule in CI: provision, seed, destroy, restore, assert the data is intact.
The rest of the operator CLI.

## Phase A scope

In:

- A server that exists because a file in the repo says it should, with a firewall that denies everything except the ports the stack needs
- A hostname serving HTTPS with a certificate that renews itself (Hetzner) or HTTP on localhost (local)
- Postgres with at least one table whose rows belong to individual users
- An HTTP API over that database
- Row access enforced inside the database, driven by a signed token the caller presents
- An operator CLI: provision, teardown, mint-token
- The two-token acceptance test

Out:

- Authentication flows (signup, login, magic links)
- Object storage
- The dashboard
- Backups
- Realtime
- Multi-node
- Container orchestration (Kubernetes and the like)
- Any hosted control plane
- A Baseplate-owned cloud account, or Hetzner credentials that are not the operator's

Docker Compose on one machine is how the three processes run.
That is not orchestration.

If a task feels like it belongs to an out item, stop and ask.

## Phase A done

Two callers hold two different tokens, hit the same endpoint, and each gets back only their own rows.
A caller with no token gets nothing.
A caller who edits their token gets nothing.

This is proven with plain HTTP calls.
No application server sits in between doing the filtering.

The script that proves it is `tests/acceptance/two-token.sh`.
That script is the definition of done, not a formality.

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

The interesting work is the access model and the operator experience, not reimplementing those pieces.

Every capability is one command.
If a step needs a human to read a wiki, it is not done.
