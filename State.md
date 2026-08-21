# Fix log

Live status of the audit below.
Updated as each finding is closed, with the commit that closed it.

| # | Finding | Verdict on the finding | Status |
| --- | --- | --- | --- |
| 1 | Hetzner operator data plane points at the local machine | Confirmed | **fixed** `a21cd6e` |
| 2 | Terraform state crosses the package and project roots | Confirmed | **fixed** `62fb894` |
| 3 | Installed `dashboard` cannot resolve tsx | Confirmed | **fixed** `cb619c8`, `bf77ce7` |
| 4 | Storage, backup, user admin bypass the application layer | Confirmed | built, under adversarial review |
| 5 | The example teaches schema-as-code | Partly. See note under the finding | **fixed** `0f2f101` |
| 6 | Backup and restore are not release-proven | Confirmed | **fixed** `8ecd6ae` |
| 7 | Acceptance auth is sensitive to shared rate-limit state | Confirmed | **fixed** `8ecd6ae` |
| 8 | Nine pure-restatement READMEs and audience overlap | Confirmed | **fixed** `3f9ac60` |
| 9 | Canonical facts have drifted | Confirmed | **fixed** `3f9ac60` |
| 10 | Dashboard breaks the feature/pattern boundary | Confirmed | **fixed** `51c9d39`, locked by `ddabb57` |
| 11 | `src/` and `stack/` duplicated contracts have drifted | Confirmed | **fixed** `9d8a92e` |
| 12 | Architectural lint is narrower than the documented rule | Confirmed | **fixed** `b335254`, `ddabb57` |
| 13 | Operator-visible failures become empty success states | Confirmed | **fixed** `a21cd6e`, `16902fb` |
| 14 | Two unused surfaces misrepresent what the package ships | Half wrong. See note under the finding | **fixed** `b12f9c8` |

## Landed before this pass

Five commits of already-finished work, split into groups:

- `93e421a` count the running stacks docker cannot place, and ask it directly
- `e53f1ac` switch projects from the studio
- `8668f18` every setting an operator can change has a field
- `849741b` the tables page keeps the rendering and hands the rest away
- `a97b9f6` the readme gets you running, and app testing gets a page of its own

## Verdict

Baseplate is coherent in intent and has a strong local core, but its target boundary is not coherent.
The single most expensive problem is the Hetzner path: Terraform writes state into the installed package root, while operator database and HTTP traffic still targets local loopback addresses.
That is more than the acknowledged lack of live-domain validation.
It can make the remote Studio unusable, cross project boundaries, or act on the wrong local system.
Below that, the main structural issue is that several operator capabilities bypass the application layer, causing delivery surfaces to duplicate business orchestration.

## Scorecard

| Area                 | Status   | Reason                                                                                                                              |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Layers               | Strained | Schema and provisioning follow the model; storage, backups, and user administration expose raw adapters to delivery.                |
| Two-roots discipline | Broken   | Terraform uses the package `infra/` directory as its working and state directory.                                                   |
| Documentation        | Strained | The canonical set is useful, but 9 one-line READMEs add no information and several claims are stale or conflicting.                 |
| Tests                | Strained | Local rows, auth, and objects are strong; remote operation and restore lack repeatable product proof, and acceptance auth is flaky. |
| SDK / CLI split      | Broken   | SDK publishing is sound, but the installed `dashboard` command bypasses the correct tsx resolver.                                   |
| `stack/` vs `src/`   | Strained | The boundary is conceptually sound, but duplicated contracts have already drifted.                                                  |
| Dashboard            | Strained | Product state and networking leak into components and `patterns/`, contrary to the documented boundary.                             |

## Verification performed

- Counted and read all 26 Markdown files.
- Inspected package exports, packed contents, CLI entrypoints, CI, scripts, architecture rules, and dependency-cruiser configuration.
- Traced schema changes, auth, object storage, backup and restore, and local versus Hetzner provisioning.
- `npm test`: passed, 258 tests across 40 files.
- `npm run test:integration`: passed, 46 tests across 7 files.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run lint:arch`: passed under the repository-required Node version, covering 231 modules and 776 dependencies.
- Acceptance tests passed on a repeat run.
  The first chained run stopped after `two-token.sh`, consistent with the shared authentication rate limiter described below.
- A packed-install smoke test reproduced the installed `baseplate dashboard` failure.
- The running local system contained successful drill records, but the repository has no repeatable backup or restore acceptance test.
- No tracked files were edited or committed.
  `npm pack --ignore-scripts` still invoked the existing `prepare` lifecycle and refreshed ignored `sdk/dist` output, without changing the tracked diff.

# Ranked findings

## 1. The Hetzner operator data plane still points at the local machine

**Severity:** blocker  
**Axis:** A, F

**Evidence**

- The architecture says the remote Studio reaches Postgres through SSH in [docs/ARCHITECTURE.md:145](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:145).
- Infrastructure constructs every Postgres administration adapter with `host: "127.0.0.1"` before selecting the target in [src/infrastructure/index.ts:90](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/index.ts:90).
- The remote compose adapter only synchronizes and runs Compose over SSH.
  It does not establish a database or API tunnel in [src/infrastructure/ssh/remote-compose.ts:39](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/ssh/remote-compose.ts:39).
- The operator HTTP database proxy always forwards row and auth traffic to `127.0.0.1` in [src/delivery/operator-http/db-proxy.ts:27](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/operator-http/db-proxy.ts:27).
- The test suite contains Hetzner account API unit tests, but no remote runtime connectivity test.

**Why it matters**

The operator believes they are managing the selected remote system.
The current wiring can instead query or mutate a local Baseplate stack that happens to use the same ports.
This violates the identity of the managed running system and can cross project boundaries.

**Recommendation:** Fill the target-aware connectivity gap with one operator connectivity boundary that supplies both Postgres and API endpoints for the selected local or Hetzner project.

> **Fixed** in `a21cd6e`. Confirmed exactly as described.
> The database endpoint is now resolved by target in the composition root: local is loopback and the published port, Hetzner is an SSH tunnel to the server's loopback, which is what `stack/compose.yaml` already said would happen.
> Tunnels are shared per destination and torn down with the process, because the studio builds an operator per request.
> The API endpoint follows the rule the domain already had in `apiBaseUrl`, so the studio proxy targets `https://<hostname>` on a remote project.
> A Hetzner project with no server now refuses instead of falling back to loopback.
> Composing an operator became asynchronous, since the tunnel has to be up before the first query.
> Covered by `tests/unit/infrastructure/operator-target.test.ts` and `tests/unit/delivery/api-base.test.ts`.
> Not yet exercised against a live server; that is the outstanding Hetzner run.
>
> **Reproduced before and after**, which is the part worth recording.
> A throwaway project was set to `TARGET=hetzner` with a hostname, no server, and - the case that makes it dangerous - the same Postgres password as the local stack.
> Built from `a97b9f6` in a separate worktree, the studio reported that remote project as having 4 tables, 27 buckets and 24 objects, and `/api/db/notes` was answered by the local machine's PostgREST.
> Every number was read from the laptop and presented as the server.
> On the fixed build, the same project answers `live: false` with "This project targets Hetzner and has no server yet", and the proxy names `https://api.example.com` as the address that did not answer.

## 2. Terraform state crosses the package and project roots

**Severity:** blocker  
**Axis:** A, F

**Evidence**

- The package root is documented as immutable release content, while mutable project state belongs under `.baseplate/`, in [docs/ARCHITECTURE.md:111](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:111).
- Operator setup passes the package `infra/` directory to the Hetzner provider in [src/delivery/operator-setup.ts:164](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/operator-setup.ts:164).
- Terraform runs `init`, `apply`, and `output` with that directory as its working directory and without a project-scoped state path in [src/infrastructure/hetzner/provider.ts:20](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/hetzner/provider.ts:20).
- [infra/README.md:45](/Users/leandervandiepen/Documents/dpn/baseplate/infra/README.md:45) explicitly says Terraform state lives inside `infra/`.

**Why it matters**

Multiple operator projects share one mutable state location.
An installed-package upgrade can move or discard that state.
A subsequent apply or destroy can address the wrong server or leave infrastructure orphaned.

**Recommendation:** Move the Terraform working directory, data directory, and state into the selected project's `.baseplate/`, while continuing to consume `infra/` as immutable package input.

> **Fixed** in `62fb894`. Done exactly as recommended.
> `infra/` is copied into `<project>/.baseplate/infra/` on every run and Terraform works there, so the copy is also how a new version reaches an existing project.
> `destroy` now runs `init` first, because a project opened on another machine has state and no providers, and a destroy that fails is how an operator keeps paying for a server.
> `infra/README.md` corrected.
> Covered by `tests/unit/infrastructure/terraform-workdir.test.ts`, including that an upgrade replaces the configuration and keeps the state.

## 3. The installed `dashboard` command cannot resolve tsx

**Severity:** blocker  
**Axis:** F

**Evidence**

- The binary entrypoint deliberately resolves tsx by module ID so npm hoisting works in [bin/tsx-entry.js:6](/Users/leandervandiepen/Documents/dpn/baseplate/bin/tsx-entry.js:6).
- The dashboard command bypasses that path and directly addresses `PACKAGE_ROOT/node_modules/tsx/dist/cli.mjs` in [src/delivery/cli/main.ts:272](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/cli/main.ts:272).
- The CLI test invokes the binary from this checkout, not from a packed installation, in [tests/unit/delivery/cli-help.test.ts:10](/Users/leandervandiepen/Documents/dpn/baseplate/tests/unit/delivery/cli-help.test.ts:10).
- In a temporary packed installation, tsx was hoisted and the hard-coded nested path did not exist.
  `baseplate dashboard` exited with `MODULE_NOT_FOUND`.

**Why it matters**

The operator installs a package rather than running the checkout.
A command that works only with the repository dependency layout is not a functioning product path.

**Recommendation:** Route the dashboard child process through the existing module-ID resolver and cover it with one packed-install smoke test.

> **Fixed** in `cb619c8`. Reproduced first: the hard-coded path does not exist in a packed install.
> The CLI now starts `bin/baseplate-dashboard.js`, which already resolved tsx correctly, rather than keeping a second and wrong answer.
> Two guards: a unit test that no file in `src` or `bin` addresses another package's install layout by path, and `scripts/smoke-install.sh`, which packs, installs elsewhere, and runs both the CLI and the studio.

## 4. Storage, backup, and user administration bypass the application layer

**Severity:** major  
**Axis:** A, D

**Evidence**

- The architecture requires an application use case for each operator action and says delivery surfaces call those use cases in [docs/ARCHITECTURE.md:29](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:29) and [docs/ARCHITECTURE.md:52](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:52).
- The application surface contains only schema change, project listing, token minting, provision, and teardown use cases in [src/application/index.ts:30](/Users/leandervandiepen/Documents/dpn/baseplate/src/application/index.ts:30).
- Infrastructure exposes `SchemaAdmin`, `StorageAdmin`, `BackupAdmin`, and `UserAdmin` directly to delivery in [src/infrastructure/index.ts:70](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/index.ts:70).
- MCP storage orchestration performs validation and calls the adapter directly in [src/delivery/mcp/storage.ts:5](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/mcp/storage.ts:5).
- CLI storage and backup commands repeat that orchestration in [src/delivery/cli/storage-command.ts:21](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/cli/storage-command.ts:21) and [src/delivery/cli/backup-command.ts:21](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/cli/backup-command.ts:21).

**Why it matters**

The architecture currently protects schema and provisioning behavior but not the other operator capabilities.
Adding or correcting a rule requires synchronizing CLI, MCP, and HTTP delivery code.
That is exactly the second source of business rules the architecture is intended to prevent.

**Recommendation:** Move each exposed operator action behind the existing application use-case surface and stop returning raw administration ports to delivery.

> **Built**, under adversarial review before it lands.
> Four use cases: `ManageStorage`, `ManageBackups`, `ManageUsers` and `InspectSchema`.
> `Operator` exposes those and no ports, and gained a single `close()` - every route used to repeat four close calls, and two of them were already missing one.
> The duplication this removes was real: the bucket-and-usage merge was written out twice, the backup timeout and the failed-outcome rule lived in the CLI only, and the users page size differed between the CLI and the studio.
> `InspectSchema` is deliberately thin. It earns its place only because it is what lets `SchemaAdmin` stop reaching delivery, which `grep` now confirms.

## 5. The example and documentation teach schema-as-code

**Severity:** major  
**Axis:** B, G

**Evidence**

- The PRD says operators never commit a table definition or migration file in [docs/PRD.md:17](/Users/leandervandiepen/Documents/dpn/baseplate/docs/PRD.md:17).
- The operator README presents a Drizzle schema and tells readers to adopt after each push in [README.md:111](/Users/leandervandiepen/Documents/dpn/baseplate/README.md:111).
- The Kanban example instructs users to push `db/schema.ts` in [examples/kanban/README.md:19](/Users/leandervandiepen/Documents/dpn/baseplate/examples/kanban/README.md:19).
- The example declares operator tables in [examples/kanban/db/schema.ts:1](/Users/leandervandiepen/Documents/dpn/baseplate/examples/kanban/db/schema.ts:1).
- The platform README refers to nonexistent application migrations under `stack/migrations/` in [stack/platform/README.md:3](/Users/leandervandiepen/Documents/dpn/baseplate/stack/platform/README.md:3).
- Readiness and migration code retain application-migration terminology in [src/delivery/operator-http/readiness.ts:80](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/operator-http/readiness.ts:80) and [stack/migrate/src/files.ts:16](/Users/leandervandiepen/Documents/dpn/baseplate/stack/migrate/src/files.ts:16).

**Why it matters**

The front door teaches exactly the repository-managed workflow the product rejects.
An operator following the canonical README arrives at a different product model than the PRD and Studio implement.

**Recommendation:** Rewrite the example bootstrap and associated canonical guidance around runtime schema changes, then remove the phantom application-migration artifacts.

## 6. Backup and restore are operationally demonstrated but not release-proven

**Severity:** major  
**Axis:** E

**Evidence**

- The local running system contained two successful restore-drill records.
- The README says the local path is proven end to end in CI in [README.md:12](/Users/leandervandiepen/Documents/dpn/baseplate/README.md:12).
- The acceptance command contains only row access, signup/login, object access, and password reset in [package.json:16](/Users/leandervandiepen/Documents/dpn/baseplate/package.json:16).
- The only focused backup test is crypto-level coverage in [tests/unit/stack/backup-crypto.test.ts](/Users/leandervandiepen/Documents/dpn/baseplate/tests/unit/stack/backup-crypto.test.ts).
- The PRD definition of done names two-token and signup paths but no recovery path in [docs/PRD.md:95](/Users/leandervandiepen/Documents/dpn/baseplate/docs/PRD.md:95).

**Why it matters**

A drill record proves one environment at one point in time.
It does not prevent a release from breaking backup creation, decryption, object retrieval, database restoration, or post-restore HTTP behavior.

**Recommendation:** Add one acceptance scenario that creates a backup, verifies a drill, restores deliberately changed data, and confirms the recovered state through HTTP.

## 7. Acceptance authentication is sensitive to shared rate-limit state

**Severity:** major  
**Axis:** E

**Evidence**

- CI runs integration immediately before acceptance against the same stack in [.github/workflows/ci.yml:36](/Users/leandervandiepen/Documents/dpn/baseplate/.github/workflows/ci.yml:36).
- Authentication permits ten credential attempts per IP per minute in [stack/auth/src/rate-limit.ts:15](/Users/leandervandiepen/Documents/dpn/baseplate/stack/auth/src/rate-limit.ts:15).
- Signup/login expects an immediate `201` and has no `429` handling in [tests/acceptance/signup-login.sh:16](/Users/leandervandiepen/Documents/dpn/baseplate/tests/acceptance/signup-login.sh:16).
- Object access also obtains a token without retry handling in [tests/acceptance/object-access.sh:19](/Users/leandervandiepen/Documents/dpn/baseplate/tests/acceptance/object-access.sh:19).
- Password reset already demonstrates the correct pattern by respecting rate limits in [tests/acceptance/password-reset.sh:23](/Users/leandervandiepen/Documents/dpn/baseplate/tests/acceptance/password-reset.sh:23).
- The first chained run stopped after the two-token scenario, while the isolated test and a subsequent full run passed.
  Rate-limit exhaustion is the strongest inference, although the first response body was overwritten before inspection.

**Why it matters**

The definition of done is nondeterministic under the same command order used by CI.
A genuine regression can be hidden behind a retry, while a healthy release can fail because previous tests consumed the IP bucket.

**Recommendation:** Give every acceptance credential request the existing `Retry-After` behavior and collision-resistant test identities.

## 8. The Markdown inventory contains nine pure restatements and several audience overlaps

**Severity:** major  
**Axis:** B, G

There are 26 Markdown files.

| File                                                                                                                     | Audience                     | Unique claim                           | Duplication verdict                 |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------- | ----------------------------------- |
| [AGENTS.md](/Users/leandervandiepen/Documents/dpn/baseplate/AGENTS.md)                                                   | Agents and contributors      | Condensed project operating brief      | Keep                                |
| [CONTRIBUTING.md](/Users/leandervandiepen/Documents/dpn/baseplate/CONTRIBUTING.md)                                       | Human contributors           | Contributor setup and workflow         | Keep                                |
| [README.md](/Users/leandervandiepen/Documents/dpn/baseplate/README.md)                                                   | Operators and app developers | Install and first-system path          | Canonical but overloaded            |
| [SECURITY.md](/Users/leandervandiepen/Documents/dpn/baseplate/SECURITY.md)                                               | Operators and reporters      | Threat and reporting boundary          | Keep                                |
| [docs/ARCHITECTURE.md](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md)                             | Contributors                 | Layers, roots, and placement           | Canonical                           |
| [docs/CONVENTIONS.md](/Users/leandervandiepen/Documents/dpn/baseplate/docs/CONVENTIONS.md)                               | Contributors                 | Engineering and Studio rules           | Canonical                           |
| [docs/DOMAINS.md](/Users/leandervandiepen/Documents/dpn/baseplate/docs/DOMAINS.md)                                       | Contributors                 | Ubiquitous language                    | Canonical                           |
| [docs/PRD.md](/Users/leandervandiepen/Documents/dpn/baseplate/docs/PRD.md)                                               | Product and contributors     | Scope and done criteria                | Canonical                           |
| [docs/TESTING.md](/Users/leandervandiepen/Documents/dpn/baseplate/docs/TESTING.md)                                       | App developers               | App test setup                         | Duplicates README and skill         |
| [examples/kanban/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/examples/kanban/README.md)                   | Example users                | Example run instructions               | Unique but contradicts product rule |
| [infra/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/infra/README.md)                                       | Contributors                 | Hetzner prerequisites                  | Keep, correct state claim           |
| [sdk/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/sdk/README.md)                                           | App developers               | Client API                             | Canonical                           |
| [skills/baseplate-app/SKILL.md](/Users/leandervandiepen/Documents/dpn/baseplate/skills/baseplate-app/SKILL.md)           | App-building agents          | Agent-specific app workflow            | Intentional audience duplication    |
| [src/application/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/application/README.md)                   | Contributors                 | None                                   | Delete candidate                    |
| [src/application/ports/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/application/ports/README.md)       | Contributors                 | None                                   | Delete candidate                    |
| [src/application/usecases/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/application/usecases/README.md) | Contributors                 | None                                   | Delete candidate                    |
| [src/delivery/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/README.md)                         | Contributors                 | Origin, proxy, and operator HTTP traps | Load-bearing                        |
| [src/delivery/cli/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/cli/README.md)                 | Contributors                 | None                                   | Delete candidate                    |
| [src/domain/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/domain/README.md)                             | Contributors                 | None                                   | Delete candidate                    |
| [src/infrastructure/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/README.md)             | Contributors                 | None                                   | Delete candidate                    |
| [src/shared/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/src/shared/README.md)                             | Contributors                 | None                                   | Delete candidate                    |
| [stack/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/stack/README.md)                                       | Runtime contributors         | Stack-local invariants                 | Load-bearing                        |
| [stack/platform/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/stack/platform/README.md)                     | Contributors                 | No correct unique claim                | Delete candidate                    |
| [tests/acceptance/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/tests/acceptance/README.md)                 | Contributors                 | Exact shell-spec role and catalog      | Keep                                |
| [tests/integration/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/tests/integration/README.md)               | Contributors                 | None                                   | Delete candidate                    |
| [tests/unit/README.md](/Users/leandervandiepen/Documents/dpn/baseplate/tests/unit/README.md)                             | Contributors                 | None                                   | Delete candidate                    |

The nine one-line files merely name the directory layer already defined by [docs/ARCHITECTURE.md](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md).
`docs/TESTING.md`, the testing section in [README.md:153](/Users/leandervandiepen/Documents/dpn/baseplate/README.md:153), and the agent skill repeat the same app-test setup for three audiences.
The skill duplication is defensible because agents need a self-contained execution contract.
The two human-facing copies are not.

**Why it matters**

Restatement makes stale wording look authoritative and makes placement rules harder to find, while adding no local invariant.
This is already visible in the incorrect `stack/platform` migration claim.

**Recommendation:** Merge the human app-testing material into `sdk/README.md` and delete the nine one-line READMEs, `docs/TESTING.md`, and `stack/platform/README.md`.

## 9. Canonical facts have drifted from the repository

**Severity:** major  
**Axis:** B, G

| Conflict                                       | Documentation evidence                                                                                                                                                                                      | Repository evidence                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceptance suite has two scenarios             | [docs/CONVENTIONS.md:74](/Users/leandervandiepen/Documents/dpn/baseplate/docs/CONVENTIONS.md:74)                                                                                                            | [package.json:16](/Users/leandervandiepen/Documents/dpn/baseplate/package.json:16) runs four                                                                                       |
| App migrations live under `stack/migrations`   | [stack/platform/README.md:3](/Users/leandervandiepen/Documents/dpn/baseplate/stack/platform/README.md:3)                                                                                                    | [stack/migrate/src/main.ts](/Users/leandervandiepen/Documents/dpn/baseplate/stack/migrate/src/main.ts) applies shipped platform migrations; no `stack/migrations` directory exists |
| SDK install version is `^0.5.0`                | [sdk/README.md:8](/Users/leandervandiepen/Documents/dpn/baseplate/sdk/README.md:8) and [skills/baseplate-app/SKILL.md:13](/Users/leandervandiepen/Documents/dpn/baseplate/skills/baseplate-app/SKILL.md:13) | [package.json:2](/Users/leandervandiepen/Documents/dpn/baseplate/package.json:2) is `0.6.0`                                                                                        |
| Postgres only implements schema administration | [docs/ARCHITECTURE.md:153](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:153)                                                                                                        | [src/infrastructure/index.ts:75](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/index.ts:75) constructs schema, storage, backup, and user administration       |
| App test setup starts with `up`                | [README.md:153](/Users/leandervandiepen/Documents/dpn/baseplate/README.md:153) and [docs/TESTING.md:29](/Users/leandervandiepen/Documents/dpn/baseplate/docs/TESTING.md:29)                                 | [AGENTS.md:51](/Users/leandervandiepen/Documents/dpn/baseplate/AGENTS.md:51) requires `init` before the first `up`                                                                 |

**Why it matters**

Docs are declared to be current truth.
These conflicts make contributors and app builders choose which source to believe, and some choices lead to nonexistent paths or incomplete setup.

**Recommendation:** Rewrite the affected canonical passages from the current package, adapter, and test surfaces, then delete the superseded copies.

## 10. Dashboard components violate the documented feature and pattern boundary

**Severity:** major  
**Axis:** A, D

**Evidence**

- Conventions say patterns contain no product behavior or fetching, and fetching should live outside the component tree, in [docs/CONVENTIONS.md:124](/Users/leandervandiepen/Documents/dpn/baseplate/docs/CONVENTIONS.md:124).
- Storage performs fetches and mutations directly inside the feature component in [src/delivery/dashboard/features/storage.tsx:1](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/dashboard/features/storage.tsx:1).
- Settings fetches and mutates operator configuration inside the component in [src/delivery/dashboard/features/settings.tsx:1](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/dashboard/features/settings.tsx:1).
- `patterns/sidebar.tsx` contains project, target, and product navigation behavior in [src/delivery/dashboard/patterns/sidebar.tsx:17](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/dashboard/patterns/sidebar.tsx:17).
- Schema-specific product types and rendering live under `patterns/` in [src/delivery/dashboard/patterns/schema-card.tsx:5](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/dashboard/patterns/schema-card.tsx:5) and [src/delivery/dashboard/patterns/schema-graph.tsx:1](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/dashboard/patterns/schema-graph.tsx:1).
- Similar component-owned networking appears in backups, auth, tables, projects, users, logs, overview, and Hetzner settings.
- The current worktree shows settings and tables already beginning to split, so the direction is underway but incomplete.

**Why it matters**

Network state, product state, and rendering are coupled across large components.
This creates dual orchestration sources alongside operator HTTP and makes product-specific patterns difficult to reuse or reason about.

**Recommendation:** Re-establish the documented boundary by moving product-aware patterns into their owning features and consolidating each feature's remote state in a feature-local data capsule.

## 11. Contracts duplicated between `src/` and `stack/` have already drifted

**Severity:** minor  
**Axis:** C, D

**Evidence**

- Operator-side email parsing uses the stricter domain implementation in [src/domain/email.ts:3](/Users/leandervandiepen/Documents/dpn/baseplate/src/domain/email.ts:3).
- Runtime signup uses a different, looser expression in [stack/auth/src/email.ts:1](/Users/leandervandiepen/Documents/dpn/baseplate/stack/auth/src/email.ts:1).
- Operator user creation applies the domain implementation in [src/infrastructure/postgres/user-admin.ts:62](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/postgres/user-admin.ts:62), while public signup applies the runtime implementation in [stack/auth/src/http.ts:57](/Users/leandervandiepen/Documents/dpn/baseplate/stack/auth/src/http.ts:57).
- Password duplication is explicitly pinned with a compatibility test in [tests/unit/infrastructure/password-compat.test.ts:8](/Users/leandervandiepen/Documents/dpn/baseplate/tests/unit/infrastructure/password-compat.test.ts:8).
- RLS policy rendering is also duplicated between [src/infrastructure/postgres/render-change.ts:50](/Users/leandervandiepen/Documents/dpn/baseplate/src/infrastructure/postgres/render-change.ts:50) and [stack/migrate/src/policies.ts:95](/Users/leandervandiepen/Documents/dpn/baseplate/stack/migrate/src/policies.ts:95), without an equivalent compatibility test.

**Why it matters**

Users created through operator administration and public signup can receive different validation outcomes.
RLS bootstrap and later schema changes can also diverge while both sides remain locally type-correct.

**Recommendation:** Pin the intentional cross-runtime duplicates with compatibility tests and align the email and policy implementations to those contracts.

## 12. Architectural enforcement is narrower than the documented rule

**Severity:** minor  
**Axis:** A, G

**Evidence**

- Architecture says external consumers use every layer through its barrel and that `shared` has no dependencies in [docs/ARCHITECTURE.md:14](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:14) and [docs/ARCHITECTURE.md:72](/Users/leandervandiepen/Documents/dpn/baseplate/docs/ARCHITECTURE.md:72).
- Dependency-cruiser enforces deep-import constraints for domain and application, but not equivalent infrastructure/shared barrel rules or the shared dependency prohibition, in [dependency-cruiser.cjs:3](/Users/leandervandiepen/Documents/dpn/baseplate/dependency-cruiser.cjs:3).
- The current code passes the architectural lint and `shared` is currently clean.
  This is an enforcement gap rather than a present leak.

**Why it matters**

The project describes architectural lint as the protection for these rules.
Future violations can pass the named command and still contradict the placement contract.

**Recommendation:** Extend the existing dependency-cruiser rules to cover the complete documented barrel and `shared` constraints.

## 13. Some operator-visible failures are converted into empty success states

**Severity:** minor  
**Axis:** F

**Evidence**

- Conventions require explicit error propagation rather than swallowing failures in [docs/CONVENTIONS.md:18](/Users/leandervandiepen/Documents/dpn/baseplate/docs/CONVENTIONS.md:18).
- History loading catches any configuration or database failure and returns an empty `entries` array in [src/delivery/operator-http/handle-request.ts:191](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/operator-http/handle-request.ts:191).
- Settings converts configuration-loading failure to `undefined` in [src/delivery/dashboard/features/settings.tsx:55](/Users/leandervandiepen/Documents/dpn/baseplate/src/delivery/dashboard/features/settings.tsx:55).
- Table loading at least retains a `live: false` distinction, demonstrating an existing structured alternative in the same operator HTTP handler.

**Why it matters**

An operator can see “no history” or an apparently blank configuration when the selected running system is unreachable or misconfigured.
That masks exactly the target-selection failures that remote operation must surface.

**Recommendation:** Return and render the existing structured live/error state instead of converting connectivity failures into empty data.

> **Fixed** on the server in `a21cd6e`, as part of finding 1 - the two are the same problem.
> A remote target has to be able to say "I cannot reach your server", and that is impossible while every failure becomes an empty list.
> `/api/schema`, `/api/history` and `/api/overview` now carry a `problem` alongside the empty answer.
> Rendering it in the studio is still open, because the dashboard is being refactored in parallel.

## 14. Two unused surfaces misrepresent what the package ships

**Severity:** minor  
**Axis:** D, G

**Evidence**

- [src/index.ts:1](/Users/leandervandiepen/Documents/dpn/baseplate/src/index.ts:1) describes itself as the package entry and re-exports SDK source.
- Actual root and client exports both address compiled `sdk/dist` files in [package.json:90](/Users/leandervandiepen/Documents/dpn/baseplate/package.json:90).
- No code imports the source package entry.
- `migrationFiles` in [stack/migrate/src/files.ts:16](/Users/leandervandiepen/Documents/dpn/baseplate/stack/migrate/src/files.ts:16) has no callers and supports the stale application-migration story.
- The active migrator obtains shipped platform migrations through a different path in [stack/migrate/src/main.ts](/Users/leandervandiepen/Documents/dpn/baseplate/stack/migrate/src/main.ts).

**Why it matters**

Both files offer plausible but false answers to “where is the package entry?” and “where do application migrations come from?”
They amplify the documentation conflicts without providing runtime behavior.

**Recommendation:** Delete `src/index.ts` and the unused application-migration file surface.

> **Half fixed** in `b12f9c8`, because half the finding is wrong.
> `src/index.ts` is genuinely unused and is deleted.
> `stack/migrate/src/files.ts` is not: `apply.ts` calls `readMigrations`, `checksum` and `splitStatements` on every start to apply the platform migrations, and five tests cover them.
> There is no `migrationFiles` symbol anywhere in the repository, so that part of the evidence does not hold.
> What was true is the comment, which said the directory exists so `drizzle-kit generate` can target it. That is the app-migration story the product does not have, and it is rewritten.

# 1. Delete or merge now

- Delete the nine one-line READMEs under `src/application`, `src/application/ports`, `src/application/usecases`, `src/delivery/cli`, `src/domain`, `src/infrastructure`, `src/shared`, `tests/integration`, and `tests/unit`.
- Merge the human app-testing material into `sdk/README.md`, remove the duplicate README section, and delete `docs/TESTING.md`.
- Delete `stack/platform/README.md`.
- Delete unused `src/index.ts`.
- Delete the unused `migrationFiles` surface and its phantom `stack/migrations` references.

# 2. Do not touch

- Keep `README.md`, `sdk/README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DOMAINS.md`, `docs/CONVENTIONS.md`, `AGENTS.md`, and `CONTRIBUTING.md` as the canonical document set.
- Keep `SECURITY.md`, `src/delivery/README.md`, `stack/README.md`, and `tests/acceptance/README.md` because they contain audience-specific or local invariants.
- Keep `stack/platform` as Baseplate's shipped schema.
- Keep RLS policy installation and reapplication inside the running database.
- Keep the SDK compiled-to-JavaScript and CLI TypeScript-through-tsx split.
- Keep shell acceptance scenarios as compact product specifications.
- Keep local-only Studio operation and Hetzner BYOK as the product boundary.
- Do not add operator-managed migrations, a hosted control plane, or an operator table directory to the package.

# 3. Fill or fix next

1. Provide target-aware operator Postgres and API connectivity for Hetzner.
2. Put Terraform working state under the selected project's `.baseplate/`.
3. Fix the installed dashboard launcher and add a packed-install smoke test.
4. Put storage, backup, and user administration behind application use cases.
5. Replace schema-as-code guidance and the Kanban schema bootstrap with runtime schema operations.
6. Add one backup, drill, restore, and HTTP recovery acceptance scenario.
7. Make acceptance authentication consistently respect `Retry-After`.
8. Restore the documented dashboard feature and pattern boundary.
9. Pin email and RLS policy compatibility across `src/` and `stack/`.
10. Correct the stale acceptance, version, adapter, and setup claims in canonical docs.
11. Extend architectural lint to cover infrastructure barrels and `shared`.
12. Preserve structured connectivity failures through operator HTTP and the dashboard.
