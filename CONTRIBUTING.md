# Contributing

Contributions are welcome.
You do not need repository access to contribute.
Fork the repository, create a branch in your fork, and open a pull request against `main`.

Report security vulnerabilities through the private process in [`SECURITY.md`](SECURITY.md), not in a public issue.

## Read the project rules

Read [`AGENTS.md`](AGENTS.md) before changing code.
It defines the product boundary, architecture, and rules that apply to every contribution.

Use these references when your change touches their area:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains the layers and where code belongs.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) covers naming, errors, secrets, tests, commits, and studio UI.
- [`docs/DOMAINS.md`](docs/DOMAINS.md) defines the product concepts and invariants.
- [`docs/PRD.md`](docs/PRD.md) defines the current scope and completion criteria.

## Set up the repository

You need Docker and Node.js 22 or newer.

```bash
git clone https://github.com/<your-account>/baseplate.git
cd baseplate
npm ci

./scripts/dev init
./scripts/dev up
```

`./scripts/dev` runs the CLI from this checkout and uses the repository as its local Baseplate project.
The generated `baseplate.env` and `.baseplate/` directory stay ignored by Git.
People installing a release use the published `baseplate` command instead.

## Make a focused change

Small fixes can go directly into a pull request.
Open an issue first when a change introduces new product behavior, changes a public API, or may sit outside the documented scope.

Keep documentation in the same pull request as the behavior it describes.
Documentation states what is true now and does not keep a history of replaced behavior.

These rules shape every implementation:

- An operator manages a running system, not this codebase.
  Their tables and mutable state belong to their project and database.
- Postgres row-level security enforces row access.
  Application-side filtering is not a security boundary.
- Architecture dependencies point inward.
  Import through the public layer aliases outside a layer.
- Baseplate remains a self-hosted, single-node backend.
  A hosted control plane, realtime, Kubernetes, and managed-platform feature parity are outside the current scope.

## Run the required checks

Run the fast checks first:

```bash
npm run lint
npm run lint:arch
npm run typecheck
npm test
```

Verify the package people will install:

```bash
npm run pack:check
bash scripts/smoke-install.sh
npm run test:artifact
```

`test:artifact` packs Baseplate, installs it into an empty project, starts that installed copy, runs the full acceptance suite, and removes the temporary stack.

Run the integration suite against the checkout while the development stack is up:

```bash
./scripts/dev up
npm run test:integration
./scripts/dev down
```

GitHub requires the `check`, `install`, `stack`, and `artifact` jobs to pass before `main` can change.

## Open the pull request

Explain the behavior that changes, why it changes, and how you verified it.
Keep the pull request focused enough to review as one decision.
Resolve review conversations and update the branch with `main` when GitHub asks.

Use a short, lowercase, imperative commit message that explains the intent:

```text
enforce row access in postgres so the api cannot leak rows
```

Do not use messages such as `update files`.
Do not add an agent as a co-author.

After the required checks pass, a maintainer can squash or rebase the pull request into `main`.
