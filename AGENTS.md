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

Local is proven end to end: rows, objects, auth, and a restore that has been drilled.
Hetzner BYOK (`TARGET=hetzner`) is implemented and preflighted in Settings, but has not run live against a real domain.
Do not build a hosted control plane. If a task feels like one, stop and ask.

## Commands

```
npm test                 unit
npm run test:integration boots the stack, speaks HTTP
npm run test:acceptance  the definition of done, against this checkout
npm run test:artifact    the same, against the packed tarball
npm run pack:check       what is in the tarball, and how big
npm run lint             eslint
npm run lint:arch        dependency-cruiser
npm run typecheck        src, stack services, and the dashboard
npm run deps:stack       each stack service's own dependencies

./scripts/dev <command>  the CLI from this checkout, with the repo as the project
```

`./scripts/dev` exists for working on Baseplate itself.
An operator never uses it; they install the package and run `baseplate`.
Run `./scripts/dev init` once, then `./scripts/dev up`, before integration or acceptance tests.

## Architecture

Four layers, dependencies pointing inward only.
Outside a layer, import `#domain`, `#application`, `#infrastructure`, or `#shared` and nothing deeper.

`docs/ARCHITECTURE.md` holds the layers, the two roots, where state lives, and the table of where a new file goes.
Do not answer that question from memory; the table is the answer.

Two constraints that are easy to trip over:

`sdk/src` is imported by apps as TypeScript, so it must survive Node's strip-only type removal: no parameter properties, enums, or namespaces.
A lint rule enforces this.

`stack/platform/` is Baseplate's own schema and ships with the version.
There is no directory for an operator's tables, by design.

The client is compiled to JS before publishing (`npm run build`, run by `prepare`).
The CLI is not: it runs through tsx on purpose, so there is one source of truth for it.
`bin/` must resolve tsx by module id, never by a path into `node_modules`, or the installed CLI cannot start.

## Docs

| File | What it is |
| --- | --- |
| `README.md` | The front door: install, first table, first app |
| `docs/PRD.md` | Product, phases, done criteria, DX bar |
| `docs/ARCHITECTURE.md` | Layers, dependency rule, where code goes |
| `docs/DOMAINS.md` | Ubiquitous language and per-concept rules |
| `docs/CONVENTIONS.md` | Naming, errors, secrets, tests, commits, studio UI |
| `sdk/README.md` | App client: install, auth, typed queries |
| `skills/baseplate-app/SKILL.md` | App-agent skill: client, RLS, types, tests |

Docs are current truth. On any major decision, edit the affected doc in place and delete what it replaced.
Never append a history, an ADR, or a changelog of choices. Git holds the past.
If a doc and the code disagree, that is a bug. Fix it before continuing.
