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

Public shape lives in `stack/` and `infra/` and is committed.
Secrets and operator choices live in `operator.env`, which is gitignored.
`operator.env.example` lists every key with empty or dummy values.

Hetzner is BYOK.
`HCLOUD_TOKEN`, `HETZNER_DNS_TOKEN`, `HETZNER_DNS_ZONE`, and `SSH_KEY_NAME` are the operator's credentials for their own Hetzner account.
They live only in `operator.env` on the operator's machine.
They are never committed, never sent to a Baseplate service, and never replaced by a Baseplate-owned token.
For `TARGET=hetzner`, `stack/stack.json` hostname must be an FQDN under `HETZNER_DNS_ZONE`, and `SITE_ADDRESS` must equal that hostname.

Never read `process.env` inside domain or application.
Delivery loads env.
Infrastructure adapters receive values through constructors.

JWT secret is at least 32 characters.
Database passwords are generated once per environment and stored only in `operator.env`.

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
Needs a running stack (`./scripts/provision` first).
Few.

The acceptance script is the end-to-end proof of row access.
Dashboard work does not replace it.
There is no requirement for a browser suite until a dashboard screen exists.

Name tests by the behaviour: `rejects a stack with a policy on a missing table`.
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
