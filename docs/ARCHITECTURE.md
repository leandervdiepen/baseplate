# Architecture

Four layers.
Dependencies point inward only.
Nothing in an inner layer knows an outer layer exists.

```
delivery        CLI + dashboard + localhost operator HTTP + MCP
application     use cases + ports they own
domain          types and rules
infrastructure  adapters behind the ports
```

`shared/` sits beside these layers.
It has no dependencies and no domain meaning.

## Layers

### Domain

The model of a running stack: servers, tables, columns, schema changes, callers, token claims.
Pure types and rules.
No I/O, no SDKs, no environment variables, no imports from any other layer.

Public surface: `src/domain/index.ts`.

### Application

Use cases, one per thing the operator can do.
Each use case declares the capabilities it needs as an interface it owns (a port) in `src/application/ports/`.
Use cases contain the sequencing and the rules.
They never import a vendor SDK.

Public surface: `src/application/index.ts`.

The dashboard does not grow a second set of rules.
MCP follows that same rule.
Save-config, provision, teardown, mint-token, and (later) logs are use cases.
The CLI, studio, and MCP call them.

### Infrastructure

Adapters that implement those ports against real systems.
One folder per external system.
That system's name appears nowhere else in `src/`.

`src/infrastructure/index.ts` is the composition root.
It is the only place concrete types are chosen.

### Delivery

Four surfaces, same use cases:

| Surface | Folder | Job |
| --- | --- | --- |
| CLI | `src/delivery/cli/` | Parse argv, print a line, exit |
| Operator HTTP | `src/delivery/operator-http/` | Bind 127.0.0.1, map HTTP to use cases, write the project config |
| Dashboard | `src/delivery/dashboard/` | React UI. Typed props. No secrets in `localStorage` |
| MCP | `src/delivery/mcp/` | Stdio JSON-RPC. Map tools to use cases. Spawned as `baseplate mcp` in the project. Never binds a port. |

The browser talks only to operator HTTP on localhost.
It never talks to Hetzner.
It never holds `HCLOUD_TOKEN`.

Contains no domain rules.

## Dependency rule

A file in layer N may import from layer N and from layers inside N.
It may not import from a layer outside N.

A layer's folder exposes an `index.ts`.
Nothing outside that layer imports a deeper path.
Outside a layer, import only `#domain`, `#application`, `#infrastructure`, or `#shared`.

This is enforced by `dependency-cruiser` (`npm run lint:arch`).
If a use case cannot run against in-memory adapters, with no server, no network, and no Hetzner token, the layering is wrong.

Delivery loads the project's `baseplate.env` and passes values into `createOperator`.
Adapters take those values in their constructors.
They do not read operator keys from `process.env`.

## Where does this go

| Kind of change | Location |
| --- | --- |
| Invariant about who can see a row | `src/domain/` |
| SQL text for a schema change | `src/infrastructure/postgres/` |
| A new operator action | `src/application/usecases/` plus a port in `src/application/ports/` |
| Talk to Hetzner, Docker, SSH, or JWT crypto | `src/infrastructure/<system>/` |
| A CLI flag or printed line | `src/delivery/cli/` |
| Localhost JSON for the dashboard | `src/delivery/operator-http/` |
| A screen or component | `src/delivery/dashboard/` |
| Operator MCP tool or protocol | `src/delivery/mcp/` |
| Typed app client | `sdk/src/` (published as the `/client` subpath) |
| A helper with no business meaning | `src/shared/` |
| Compose, Caddyfile, platform schema, auth, migrate | `stack/` |
| Terraform for the server | `infra/` |
| Proof that row access holds | `tests/acceptance/` |
| Use case and domain tests | `tests/unit/` |
| Tests that boot the real stack | `tests/integration/` |

If it has meaning in the product language, it is not `shared/`.
Watch that folder.

## Two roots

Baseplate is installed; it is not cloned. That splits every path in two.

**Package root** is where Baseplate lives: `stack/`, `infra/`, `src/`, `sdk/`.
It is read-only from an operator's point of view and it changes when they install a different version.

**Project root** is the operator's own directory: `baseplate.env` and `.baseplate/`.
`baseplate init` creates it; nothing else Baseplate ships is ever written there.

`src/delivery/paths.ts` names both. Code that takes one must not assume the other.

## Where state lives

`stack/` is what runs: Postgres, PostgREST, Caddy, the auth service, and the migrate service.
`stack/platform/` is Baseplate's own schema, versioned with the package.
`infra/` is the server: Terraform that uses the operator's Hetzner token.
`src/` is the operator tool that brings those to life.

**An operator's tables are not in any of them.**
They live in the operator's database, along with the registry that says which of them carry row access (`baseplate.tables`) and the record of every change (`baseplate.schema_history`).
The migrate service re-applies row access from that registry on every start, so a restart cannot leave a table exposed.

This is the load-bearing decision: an operator runs a system, they do not maintain a fork.

PostgREST is the HTTP API for tables.
`stack/auth/` is the HTTP API for signup, login, refresh, and logout.
Callers hit those directly.
The studio is an operator client, not a row filter.
The client wraps the same HTTP and never filters rows itself.

The studio reaches Postgres over a loopback-published port to apply schema changes.
On a remote target it reaches the same port through the SSH access provisioning already uses.
Nothing about schema editing is exposed publicly.

## Current adapters

| Folder | Port it implements |
| --- | --- |
| `memory/` | In-memory fakes of every port, for unit tests |
| `docker/` | Local `CloudProvider` and `StackRuntime` |
| `hetzner/` | `CloudProvider` against the operator's Hetzner account (BYOK) |
| `ssh/` | Remote `StackRuntime` |
| `jwt/` | `TokenSigner` |
| `postgres/` | `SchemaAdmin`, against the operator's database |
| `fs/` | `StackStateStore` |
| `clock/` | `Clock` |

## Tests and the layers

Unit tests construct use cases with memory adapters exported from `#infrastructure`.
JWT signing has no I/O, so it may be unit-tested too.

Integration tests boot `stack/` with Docker Compose and speak HTTP.

Acceptance tests are scripts.
They prove the product, not the TypeScript.

Dashboard tests, when they exist, do not replace `two-token.sh`.
