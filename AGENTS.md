# Baseplate

Platform on top of your Hetzner account. You bring the API token (BYOK).
The repo is the system: destroy the server and rebuild from these files.
Not a managed-platform competitor. Feature parity is a non-goal.

## Scope

Phase B (active): a local operator dashboard with one-command DX.
Phase A local is proven (`npm run test:acceptance` after `./scripts/provision`).
Hetzner BYOK (`TARGET=hetzner`) still needs the operator's own domain in Hetzner DNS.
That work is parked on DPN-146 until they have a zone.
Do not build Phase C.
If a task feels like a hosted control plane, stop and ask.

Linear: project Baseplate, team diepen (`DPN`).
Use the **linear-personal** MCP (workspace diepenio), never the employer Linear.

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
./scripts/dashboard
```

Dashboard (Phase B): `./scripts/dashboard` binds to 127.0.0.1 only.
Secrets stay on this machine.

## Architecture

Dependencies point inward only. Import `#domain`, `#application`, `#infrastructure`, `#shared` only.
Details: `docs/ARCHITECTURE.md`.

## Where a new file goes

- Types and rules: `src/domain/`
- Operator action: `src/application/usecases/` plus a port in `src/application/ports/`
- Vendor or OS: `src/infrastructure/<system>/`
- CLI: `src/delivery/cli/`
- Dashboard UI: `src/delivery/dashboard/` (primitives / patterns / features)
- Local operator HTTP (localhost, calls use cases): `src/delivery/operator-http/`
- Typed app client: `sdk/` (file dependency, not an npm cloud)
- Schema, Compose, API surface, user auth: `stack/` (never `src/`)
- Server: `infra/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/acceptance/`
- No business meaning: `src/shared/`

Visual source: Paper file [Baseplate operator dashboard](https://app.paper.design/file/01M07TKASYE9J372976D943J30).
Tokens land in `src/delivery/dashboard/styles/tokens.css`.
UI rules: `docs/COMPONENTS.md`.

## Docs

Docs are current truth. On any major decision, edit the affected doc in place and delete what it replaced.
Never append a history, an ADR, or a changelog of choices. Git holds the past.
If a doc and the code disagree, that is a bug. Fix it before continuing.
