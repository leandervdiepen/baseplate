# Baseplate

A Postgres backend you run yourself: an HTTP API over your tables with per-user row access, email and password auth, file storage, encrypted backups, and a local studio to drive it all.

[![CI](https://github.com/leandervdiepen/baseplate/actions/workflows/ci.yml/badge.svg)](https://github.com/leandervdiepen/baseplate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

Install a version, point it at Docker on your laptop or at your own Hetzner account, and you own the database, the API, TLS, and the access rules.
Baseplate has no cloud account, no hosted control plane, and no bill of its own.

> **Status:** the local path is proven end to end in CI, on every commit. Hetzner provisioning is implemented and preflighted but has not been run live against a real domain yet. See [Limits](#limits).

## Quick start

You need Docker running and Node 22 or newer.

```bash
mkdir my-backend && cd my-backend
npx @diepen/baseplate init      # writes baseplate.env with secrets for this project
npx @diepen/baseplate up        # starts the stack, prints your API URL
```

Make a table and reach it from an app:

```bash
npx @diepen/baseplate schema add-table notes --column title:text
npx @diepen/baseplate types > src/database.ts
```

```ts
import { createClient } from "@diepen/baseplate/client";
import type { Database } from "./database.ts";

const client = createClient<Database>("http://127.0.0.1:8080");

const { error } = await client.auth.signUp({ email, password });
await client.from("notes").insert({ title: "hello" });

const { data } = await client.from("notes").select("id,title").order("title").limit(20);
```

That is the whole loop. `data` contains this user's notes and nobody else's, because the database decided that, not the client.
Every call answers `{ data, error }` and nothing throws, so a failure is a value you render rather than an exception you catch.

```bash
npx @diepen/baseplate dashboard   # the studio, on 127.0.0.1
npx @diepen/baseplate down        # stop. your data stays
```

Run `init` in more than one directory and the studio lists them: the project name in the sidebar
opens a switcher, marks which stack is up, and points the studio at another without restarting it.
One stack runs at a time, so switching shows you the other project; starting it is still a button
you press.

## What you get

| | |
| --- | --- |
| **Postgres** | Your database. Reachable on localhost for tools like `psql` and drizzle-kit. |
| **REST API** | PostgREST over your tables, behind Caddy. Filters, ordering, pagination. |
| **Row access** | Every table is protected before it takes its first row. A caller sees rows whose `owner_id` matches the `sub` in their token. |
| **Auth** | Signup, login, refresh, logout, password reset, and email verification under `/auth/*`. Sessions persist and refresh themselves; credential endpoints are rate limited. |
| **Email** | A local inbox on `127.0.0.1:8025` catches recovery and confirmation mail in development; `SMTP_*` points production at a real server. |
| **Storage** | Buckets and objects, guarded by the same rule as rows. Signed URLs for `<img src>`. |
| **Backups** | Scheduled `pg_dump`, encrypted with a key generated for your project, plus a drill that restores one and counts what came back. |
| **Studio** | Tables with their rows, schema and row security, storage, backups, auth, logs, settings. Every setting lives here; you never open `baseplate.env` by hand. |
| **TLS** | Caddy gets a Let's Encrypt certificate for your hostname when you target Hetzner. |

## Agents

`npx @diepen/baseplate mcp` is the operator path for agents.
Run it from the project directory (where `baseplate.env` lives), or set `BASEPLATE_PROJECT`.
It speaks stdio JSON-RPC, covers the same actions as the CLI, and never binds a port.
Destructive tools need `confirm: true`.
It does not query app rows; apps use the [client](sdk/README.md).

A typical Cursor config, started with that project as cwd:

```json
{
  "mcpServers": {
    "baseplate": {
      "command": "npx",
      "args": ["@diepen/baseplate", "mcp"]
    }
  }
}
```

Agents writing an app against `@diepen/baseplate/client` load [`skills/baseplate-app/SKILL.md`](skills/baseplate-app/SKILL.md) from the package.
After install it also lives at `node_modules/@diepen/baseplate/skills/baseplate-app`.

## How row access works

There is no anon key and no public key to hand out. `JWT_SECRET` stays on the server.

A user signs up over plain HTTP and gets a JWT whose `sub` is their user id. Every table Baseplate creates gets:

- an `owner_id uuid not null` column,
- a row-level security policy matching `owner_id` against the caller's `sub`,
- a `BEFORE INSERT` trigger that stamps `owner_id` from the token, so a client cannot claim to be someone else.

A table in `public` that is not in Baseplate's registry is locked down rather than left open: row security on, grants revoked, reachable by nobody. The stack re-applies all of this on every start, so a restart can never leave a table exposed.

```bash
npx @diepen/baseplate tables    # what you have
npx @diepen/baseplate schema    # every change your database has taken
```

## Schema as code

Point drizzle-kit at the database like any other Postgres. `drizzle-kit pull` reads what is there, `drizzle-kit push` applies changes.

Baseplate did not create those tables, so hand each one over once:

```bash
npx @diepen/baseplate schema adopt-table boards
```

That records the table, writes its policy, adds the owner trigger, and grants the app role, in one transaction. Give every table an `owner_id uuid not null` column and adopt it after each push.

[`examples/kanban`](examples/kanban) is a working board built this way: drizzle for the schema, Baseplate for login, row access, and card attachments.

## Files

```bash
npx @diepen/baseplate storage add-bucket avatars
```

```ts
await client.storage.from("avatars").upload("me.png", file);
await client.storage.from("avatars").list();
const { data: url } = await client.storage.from("avatars").createSignedUrl("me.png", 3600);
```

A private bucket shows a caller only their own objects; knowing someone else's key returns 404. `add-bucket --public` makes a bucket anyone signed in can read, where only the caller who uploaded an object can replace or remove it.

Bytes live in a store on the compose network, never published. Point `STORAGE_ENDPOINT` at Hetzner Object Storage, Backblaze B2, or S3 and nothing else changes.

## Backups

A dump runs on a schedule, sealed with a key generated for your project, and goes wherever `BACKUP_S3_*` points. Name nothing and it stays on the same machine as the database, which the studio flags as not a backup.

```bash
npx @diepen/baseplate backup now
npx @diepen/baseplate backup drills   # restores that were actually verified
npx @diepen/baseplate restore <id>
```

On its own schedule the stack restores the newest backup into a scratch database and counts the tables and rows that came back. Restoring over the live database is a command, not a button, and it asks you to type the project name first.

## Testing with Playwright

Your app's end-to-end tests can run against a real stack instead of a mocked backend, which means they exercise real row-level security. Users are cheap to create over HTTP.

```bash
npm i -D @playwright/test
npx playwright install chromium
```

```ts
// tests/e2e/rls.spec.ts
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API = process.env.BASEPLATE_URL ?? "http://127.0.0.1:8080";

async function signUp() {
  const response = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `e2e-${randomUUID()}@example.test`, password: "a-good-password" }),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { token: string; user: { id: string } };
}

test("each caller sees only their own rows", async () => {
  const alice = await signUp();
  const bob = await signUp();

  await fetch(`${API}/notes`, {
    method: "POST",
    headers: { authorization: `Bearer ${alice.token}`, "content-type": "application/json" },
    body: JSON.stringify({ title: "alice only" }),
  });

  const mine = await (await fetch(`${API}/notes`, {
    headers: { authorization: `Bearer ${alice.token}` },
  })).json();
  const theirs = await (await fetch(`${API}/notes`, {
    headers: { authorization: `Bearer ${bob.token}` },
  })).json();

  expect(mine).toHaveLength(1);
  expect(theirs).toHaveLength(0);
});
```

To start a signed-in browser without going through your login form, write the session into `localStorage` before the page loads. The client reads it from there on startup.

```ts
import { SESSION_KEY } from "@diepen/baseplate/client";

const session = await signUp();
await page.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, value),
  [SESSION_KEY, JSON.stringify({ ...session, expiresAt: Date.now() + session.expiresIn * 1000 })],
);
await page.goto("/");
```

Have Playwright bring the stack up itself, so `npx playwright test` works from a clean checkout. `up` returns once the stack is healthy rather than staying in the foreground, so it belongs in `globalSetup` rather than in `webServer`:

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./tests/e2e/stack.ts",
  webServer: { command: "npm run dev", url: "http://127.0.0.1:5173", reuseExistingServer: true },
  use: { baseURL: "http://127.0.0.1:5173" },
});
```

```ts
// tests/e2e/stack.ts
import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync("npx", ["@diepen/baseplate", "up"], { stdio: "inherit" });
}
```

Running `up` against a stack that is already up is a no-op, so this is safe to repeat. One stack runs at a time, so give CI one project directory rather than one per suite.

## Going to production

Set the target to Hetzner in the studio's Settings. Baseplate creates a VM, a firewall, a DNS record, and a TLS certificate in **your** account, from your own API tokens.

Those tokens never leave your machine. Only the database, JWT, and backup secrets are sent to the server.

Paste your Cloud and DNS tokens, press **Check my account**, and the region, SSH key, and DNS zone become lists read from your account rather than three names to type from memory.

Local needs no domain, no cloud account, and no certificate.

## How it compares

Baseplate is not trying to match a managed platform feature for feature. It exists so one developer running a handful of small apps can own the whole thing.

| | Baseplate | Supabase (hosted) | Rolling your own |
| --- | --- | --- | --- |
| Who holds your data | You | Supabase | You |
| Bill from this project | None | Per project | None |
| Setup | Two commands | Sign up | Days |
| Row-level security | On by default, cannot be turned off per table | Opt in per table | Whatever you write |
| Realtime, edge functions, vector | No | Yes | Whatever you write |
| Dashboard | Local, on 127.0.0.1 | Hosted | None |

If you need realtime subscriptions, edge functions, or a team dashboard, use Supabase. If you want a database and an API you can point at a €5 VM and forget about, this is smaller and yours.

## Limits

Worth knowing before you trust it with something:

- Hetzner provisioning has not been run live against a real domain yet.
- One node. No replica and no failover, so a restore is minutes of downtime.
- Auth is email and password only: no OAuth or social login, no magic links, no MFA.
- No metrics, and no alert when a backup or drill fails: it is a log line and a row.
- No point-in-time recovery. The worst case is losing up to one backup interval of writes.
- A backup is uploaded in a single request, so S3's 5 GB limit for one is the practical ceiling. Multipart upload is not implemented.

## Commands

```
init      up        down      destroy   dashboard
mcp       tables    types     schema    storage
backup    restore   users     mint-token
```

Run `npx @diepen/baseplate --help`, or any command with no arguments, for its own list.

## Docs

| File | What it is |
| --- | --- |
| [`sdk/README.md`](sdk/README.md) | App client: install, auth, typed queries, storage |
| [`skills/baseplate-app/SKILL.md`](skills/baseplate-app/SKILL.md) | App agents: client, RLS, types, tests |
| [`docs/PRD.md`](docs/PRD.md) | Product, phases, done criteria |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, dependency rule, where code goes |
| [`docs/DOMAINS.md`](docs/DOMAINS.md) | Ubiquitous language and per-concept rules |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Naming, errors, secrets, tests, commits, studio UI |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to run it, and the rules a change is held to |
| [`SECURITY.md`](SECURITY.md) | What counts as a vulnerability, and where to send one |

## Contributing

```bash
git clone https://github.com/leandervdiepen/baseplate.git
cd baseplate && npm install
./scripts/dev init && ./scripts/dev up

npm run lint && npm run lint:arch && npm run typecheck && npm test
npm run test:integration    # boots the real stack
npm run test:acceptance     # two callers, one endpoint, disjoint rows
```

`npm run test:acceptance` is the definition of done. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE) © Leander van Diepen
