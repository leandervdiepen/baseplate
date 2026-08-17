# Baseplate

Platform on top of your Hetzner account. You bring the API token (BYOK).
The repo is the system: destroy the server and rebuild from these files.
Not a managed-platform competitor. Feature parity is a non-goal.

## Scope

Phase A (active): one command provisions an HTTP API over Postgres with per-user row access.
Hetzner (`TARGET=hetzner`, your token) adds TLS. Full phase list: `docs/PRD.md`.
If a task belongs to a later phase, stop and ask.

## Commands

```
npm install
npm test
npm run test:integration
npm run test:acceptance
npm run lint:arch
./scripts/provision
./scripts/teardown
./scripts/mint-token --sub UUID
```

## Linear

Project: https://linear.app/diepenio/project/baseplate-8380d9ef118c
Team: diepen (`DPN`). Every piece of work is an issue on this project.

## Architecture

Dependencies point inward only. Import `#domain`, `#application`, `#infrastructure`, `#shared` only.
Details: `docs/ARCHITECTURE.md`.

## Where a new file goes

- Types and rules: `src/domain/`
- Operator action: `src/application/usecases/` plus a port in `src/application/ports/`
- Vendor or OS: `src/infrastructure/<system>/`
- CLI: `src/delivery/cli/`
- Schema, Compose, API surface: `stack/` (never `src/`)
- Server: `infra/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/acceptance/`
- No business meaning: `src/shared/`

## Docs

Docs are current truth. On any major decision, edit the affected doc in place and delete what it replaced.
Never append a history, an ADR, or a changelog of choices. Git holds the past.
If a doc and the code disagree, that is a bug. Fix it before continuing.
