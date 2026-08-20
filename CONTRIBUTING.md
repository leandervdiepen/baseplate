# Contributing

Thanks for looking. This is a small project with strong opinions, and the
opinions are written down so you do not have to guess at them.

Read [`AGENTS.md`](AGENTS.md) first. It is short, and it is the same brief a
human or an agent works from.

## Get it running

You need Docker and Node 22 or newer.

```bash
npm install
./scripts/dev init      # once: writes baseplate.env and .baseplate/ here
./scripts/dev up        # starts the stack against this checkout
```

`./scripts/dev` runs the CLI from this checkout with the repo itself as the
project. An operator never uses it; they install the package and run
`baseplate`.

## Before you open a pull request

```bash
npm test                 # unit
npm run lint             # eslint
npm run lint:arch        # the layering rule, enforced not suggested
npm run typecheck        # src, the stack services, and the studio
npm run test:integration # boots the stack and speaks HTTP
npm run test:acceptance  # the definition of done
```

All of them. The integration and acceptance suites need a running stack.

## The rules that will get a change sent back

**An operator manages a running system, never a codebase.** Their tables live in
their database. If your change would have an operator edit, commit, or merge a
file in this repo, it is the wrong shape.

**The database is the gate.** Row access is row-level security in Postgres. If
filtering moves into TypeScript, the change is wrong however well it reads.

**Layers point inward.** `dependency-cruiser` enforces it. Outside a layer,
import `#domain`, `#application`, `#infrastructure`, or `#shared` and nothing
deeper.

**Docs are the present tense.** If a doc and the code disagree, that is a bug.
Fix the doc in the same change and delete what it replaced. Never append a
history or an ADR; git holds the past.

The rest — naming, errors, secrets, tests, commit messages, studio UI — is in
[`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

## Commits

Imperative, present tense, why before what.

```
enforce row access in postgres so the api cannot leak rows
```

Not `update files`. Do not add an agent as a co-author.

## Where things go

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) has a table for exactly this.
Please use it rather than guessing; it is the answer, not a summary of one.

## What is deliberately out of scope

A hosted Baseplate that holds other people's cloud keys. A Baseplate-owned cloud
account. Realtime, multi-node, Kubernetes. Feature parity with managed
platforms.

If a change feels like one of those, open an issue before writing it.
