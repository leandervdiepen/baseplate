# Conventions

## Naming

- Files: kebab-case. `provision-stack.ts`, `access-policy.ts`.
- Types: PascalCase. `AccessPolicy`, `CallerId`.
- Functions: verb-noun. `assertStack`, `parseCallerId`.
- Ports: noun of the capability, no vendor in the name. `CloudProvider`, not `HetznerClient`.
- Use cases: one file named after the action. `provision-stack.ts`.
- Tests: `*.test.ts` under `tests/unit/` or `tests/integration/`, named by behaviour.
- Database: snake_case. `owner_id`.
- HTTP: plural nouns. `GET /items`.

Branded strings over raw strings for ids and hostnames.

## Errors

Throw `DomainError` from domain and application, with a stable `code` (`stack.hostname_required`) and a human message.
Adapters wrap vendor failures as `InfraError` with a `code` and the cause.
The CLI prints `code: message` and exits non-zero.
Operator HTTP returns that same `code` as JSON to the dashboard.
Do not swallow errors.
Do not return `null` for a failure that the operator must see.

## Configuration and secrets

What Baseplate ships lives in `stack/` and `infra/` and is committed.
An operator's secrets and choices live in `baseplate.env` in **their** directory, written by `baseplate init` with secrets generated per project.
Nothing in this repo is an operator's config, and no committed file carries a working secret.

`.baseplate/stack.env` is derived from `baseplate.env` and holds only what the running stack needs.
It is the only env file that crosses the wire to a server.
Cloud credentials are never in it.

Hetzner is BYOK.
`HCLOUD_TOKEN`, `HETZNER_DNS_TOKEN`, `HETZNER_DNS_ZONE`, and `SSH_KEY_NAME` are the operator's credentials for their own Hetzner account.
They live only in the project's `baseplate.env` on the operator's machine.
They are never committed, never sent to a Baseplate service, and never replaced by a Baseplate-owned token.
For `TARGET=hetzner`, `BASEPLATE_HOSTNAME` must be an FQDN under `HETZNER_DNS_ZONE`.
`SITE_ADDRESS` is what Caddy listens on: the hostname on a cloud target, `:8080` locally.
`HTTP_PORT` is only the host port mapping; do not move one with the other.

Never read `process.env` inside domain or application.
Delivery loads env.
Infrastructure adapters receive values through constructors.

JWT secret is at least 32 characters.
Database passwords are generated once per project and stored only in that project's `baseplate.env`.

## Testing

Quantity, declining: unit, then integration, then acceptance.

**Unit** (`tests/unit/`, `npm test`).
Domain, use cases with in-memory adapters, and adapters that have no I/O (JWT).
No Docker, no network, no Hetzner token.
Fast.
This is most of the tests.

**Integration** (`tests/integration/*.test.ts`, `npm run test:integration`).
Boot `stack/` with Docker Compose.
Speak HTTP at PostgREST.
Prove RLS and JWT behaviour against the real database.
Named by behaviour, not as a mirror of `src/`.
A handful of tests.

**Acceptance** (`tests/acceptance/`, `npm run test:acceptance`).
Runs `tests/acceptance/two-token.sh` and `tests/acceptance/signup-login.sh`.
Those scripts are the definition of done.
Plain HTTP.
Needs a running stack (`./scripts/dev init` then `./scripts/dev up`).
They make the table they need, the way an operator would, because nothing in this repo declares it.
Few.

The acceptance script is the end-to-end proof of row access.
Dashboard work does not replace it.
There is no requirement for a browser suite until a dashboard screen exists.

Name tests by the behaviour: `rejects a change to a table that does not exist`.
Arrange, act, assert.

## Commits

Imperative, present tense, why before what.
`enforce row access in postgres so the api cannot leak rows`.
Not `update files`.
Do not add an agent as co-author.

User-facing shipped capability goes in `CHANGELOG.md`.
Do not record decisions there.
Git is the history of choices.
Docs are the present.

## TypeScript

Strict.
`verbatimModuleSyntax`.
No `any`.
No `!` unless a line comment says why the value exists.
Prefer `readonly` data.
Do not mutate arguments.

## Files

Aim under 200 lines.
Split by responsibility when a file grows.
No one-line wrappers.
A layer folder's `index.ts` re-exports the public surface and does nothing else.

## Linear

Every piece of work is an issue on [Baseplate](https://linear.app/diepenio/project/baseplate-8380d9ef118c).
Agents use Linear MCP **linear-personal** (workspace diepenio / team DPN).
Do not file Baseplate work on the employer Linear.
Put the issue id in the commit subject when one exists (`DPN-140: ...`).
