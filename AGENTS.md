# Baseplate

A backend an operator installs and runs: Postgres, an HTTP API with per-user row access, email and password login, and a local studio.
Published as `@diepen/baseplate`. An operator installs a version, they do not clone this.

Not a managed-platform competitor. Feature parity is a non-goal.

## The rule that shapes everything

**An operator manages a running system, never a codebase.**

Their tables live in their database, not in this repo.
A schema change is a transaction against their database, recorded in `baseplate.schema_history`.
Nothing they do writes a file here, and nothing here declares their tables.

If a task would have an operator edit, commit, or merge a file in this repo, stop and ask.

## Two roots, never confused

| Root | Holds | Written by |
| --- | --- | --- |
| Package | `stack/`, `infra/`, `src/`, `sdk/` | Baseplate, at release |
| Project | `baseplate.env`, `.baseplate/` | `baseplate init`, then the operator |

`src/delivery/paths.ts` is where the two are named. Do not reach across them.

## Scope

Local is proven end to end.
Hetzner BYOK (`TARGET=hetzner`) is implemented and preflighted in Settings, but has not run live against a real domain.
Object storage is open. Backups and restore drills are not started.
Do not build a hosted control plane. If a task feels like one, stop and ask.

Linear: project Baseplate, team diepen (`DPN`).
Use the **linear-personal** MCP (workspace diepenio), never the employer Linear.

## Commands

```
npm test                 unit
npm run test:integration boots the stack, speaks HTTP
npm run test:acceptance  the definition of done
npm run lint             eslint
npm run lint:arch        dependency-cruiser
npm run typecheck        src, stack services, and the dashboard

./scripts/dev <command>  the CLI from this checkout, project root is the repo
```

`./scripts/dev init` once, then `./scripts/dev up`, before integration or acceptance tests.

## Architecture

Dependencies point inward only. Import `#domain`, `#application`, `#infrastructure`, `#shared` only.
Details: `docs/ARCHITECTURE.md`.

## Where a new file goes

- Types and rules: `src/domain/`
- Operator action: `src/application/usecases/` plus a port in `src/application/ports/`
- Vendor or OS: `src/infrastructure/<system>/`
- CLI: `src/delivery/cli/`
- Studio UI: `src/delivery/dashboard/` (primitives / patterns / features)
- Local operator HTTP: `src/delivery/operator-http/`
- App client: `sdk/src/` (published as the `/client` subpath)
- What runs: `stack/` (compose, Caddy, platform migrations, auth, migrate)
- The server: `infra/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/acceptance/`
- No business meaning: `src/shared/`

`sdk/src` is imported by apps as TypeScript, so it must survive Node's strip-only type removal: no parameter properties, enums, or namespaces. A lint rule enforces this.

`stack/platform/` is Baseplate's own schema and ships with the version.
There is no directory for an operator's tables, by design.

Visual source: Paper file [Baseplate operator dashboard](https://app.paper.design/file/01M07TKASYE9J372976D943J30).
Tokens land in `src/delivery/dashboard/styles/tokens.css`.
UI rules: `docs/COMPONENTS.md`.

## Docs

Docs are current truth. On any major decision, edit the affected doc in place and delete what it replaced.
Never append a history, an ADR, or a changelog of choices. Git holds the past.
If a doc and the code disagree, that is a bug. Fix it before continuing.
