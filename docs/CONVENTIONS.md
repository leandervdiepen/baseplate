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

`HCLOUD_TOKEN` and `HETZNER_DNS_TOKEN` are never in it.
They can create and destroy servers, and they stay on the operator's machine.

`BACKUP_KEY` and the `BACKUP_S3_*` credentials **are** in it, deliberately.
The backup and its restore drill run where the database is, so they need the key there.
Those credentials reach one bucket; an account token reaches an account.
That difference is the whole rule, and it is why the exception is written down rather than assumed.

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
Shell scripts over plain HTTP against a running stack.
Each one proves a promise the product makes to a user end to end: what they can do, and what the database refuses them.
The `test:acceptance` script in `package.json` is the list of which ones run, so a new proof is a script named there and not a line here.
Together they are the definition of done.
Needs a running stack (`./scripts/dev init` then `./scripts/dev up`).
They make the table they need, the way an operator would, because nothing in this repo declares it.
Few.

The acceptance suite is the end-to-end proof of row access.
Dashboard work does not replace it.
The studio is checked by driving a real browser against a running stack, not by a snapshot suite.

Name tests by the behaviour: `rejects a change to a table that does not exist`.
Arrange, act, assert.

## Commits

Imperative, present tense, why before what.
`enforce row access in postgres so the api cannot leak rows`.
Not `update files`.
Do not add an agent as co-author.

There is no changelog file.
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

## Studio UI

The studio is `src/delivery/dashboard/`: Vite, React, and Tailwind, with hand-written components.
Not Next.js, and not a component library: this is a localhost operator tool, not a hosted app.
Visual source: [Baseplate operator dashboard](https://app.paper.design/file/01M07TKASYE9J372976D943J30) (alpine: snow x evergreen, IBM Plex Sans / Mono).

### Three tiers

Imports flow one way: features, then patterns, then primitives.

**Primitives** (`primitives/`) know nothing about the product.
Buttons, fields, selects, chips, icons.
Styled only through tokens.

**Patterns** (`patterns/`) combine primitives to solve a recurring layout problem: the app shell, a page header, a data table, a callout, a code block.
Still no product knowledge and no fetching.

**Features** (`features/`) are bound to one part of the product and may hold domain types.
They reach the operator only through the localhost HTTP client, never Hetzner or PostgREST directly.
A feature may import a sibling file of its own feature; it never reaches into another feature.

Anything that fetches or mutates lives outside the component tree.

### The shell is a frame

The studio is a fixed-height frame, not a long page.
The sidebar and the top bar are chrome and do not move; the content region is the only thing that scrolls.
The top bar carries the breadcrumb and which caller the studio is acting as, and neither may scroll out of view.

Anything wider than the content region brings its own scroller, and that scroller is `relative`.
Without it, an absolutely positioned child - `sr-only` text in a table cell is the one that bites - is positioned against the page and drags the page's scrollable width off screen with it.
No page of the studio scrolls sideways.

### Tokens

Colours, spacing, radii, and the type scale live in `styles/tokens.css` and nowhere else.
Name them by role (`color-danger`, `space-md`), never by hue.
No raw hex, rgb, or px values in a component file.

### Rules that are not negotiable

Every field is wired to its label through `Field`, which owns the id and points `aria-describedby` at the hint and the error.
A visible `<label>` that is only a sibling of its control labels nothing.

Never remove the focus ring.
`globals.css` draws one for the whole studio; a border colour change is not a replacement.

Hit areas are at least 40x40, or the control is wrapped in a label that is.
One filled primary action per view.
Verb-first, sentence-case labels: "Save settings", "Insert row", "Create a table".
Placeholders show a format, never a label.

Keep a submit enabled and validate on submit, with the message next to the field that failed.
Status and errors go through `StatusMessage`, so they are announced rather than only drawn.
Tabular numbers on ids, timestamps, and counts.

A control that cannot be off is not a toggle.
Row security is always on, so it is shown as status and never as a switch.

Anything destructive asks first, in a band next to what it will destroy, and says what goes.

Tailwind compiles `scale-*` to the `scale` property, so a transition has to name `scale`; naming `transform` silently does nothing.
No `transition: all`.
`prefers-reduced-motion` is honoured in `globals.css`; do not opt a component out of it.

### What a component is not

Not a use case.
Not an API client for Hetzner.
Not a place for access-policy logic.
Those belong in `src/application/` and `src/domain/`.
Secrets belong in the project's `baseplate.env`, written by operator HTTP, never in the browser.

## Issues

Work is tracked in [GitHub issues](https://github.com/leandervdiepen/baseplate/issues).
One issue per change, and the issue says why before it says what.
