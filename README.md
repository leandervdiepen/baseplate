# Baseplate

A Postgres backend you run yourself: an HTTP API over your tables with per-user row access, email and password auth, file storage, encrypted backups, and a local studio to drive it all.

[![CI](https://github.com/leandervdiepen/baseplate/actions/workflows/ci.yml/badge.svg)](https://github.com/leandervdiepen/baseplate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

Install a version, point it at Docker on your laptop or at your own Hetzner account, and you own the database, the API, TLS, and the access rules.
Baseplate has no cloud account, no hosted control plane, and no bill of its own.

> **Status:** the local path is supported and release-tested. On every commit, CI packs this package, installs it into an empty project, and runs row isolation, object isolation, password recovery and a destructive restore against the installed copy.
> Hetzner deployment is **experimental** until the first documented live drill: it is implemented and preflighted, but it has never been run against a real domain. See [Limits](#limits).

## Quick start

You need Docker running and Node 22 or newer.

```bash
mkdir my-backend && cd my-backend && mkdir src
npm init -y
npm install @diepen/baseplate@0.1.0   # the version you own

npx baseplate init                    # writes baseplate.env with secrets for this project
npx baseplate up                      # starts the stack, prints your API URL
```

Installed rather than `npx @diepen/baseplate`, for two reasons: a bare `npx` follows `latest` and would change under you, and the client below is imported from your app, so the package has to be a dependency.

Make a table and reach it from an app:

```bash
npx baseplate schema add-table notes --column title:text
npx baseplate types > src/database.ts
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
npx baseplate dashboard   # the studio, on 127.0.0.1
npx baseplate down        # stop. your data stays
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
| **Row access** | Every table is protected before it takes its first row. A row is written only by whoever owns it; reads are per-table - the owner's rows, anyone signed in, or anyone at all. |
| **Auth** | Signup, login, refresh, logout, password reset, and email verification under `/auth/*`. Sessions persist and refresh themselves; credential endpoints are rate limited. |
| **Email** | A local inbox on `127.0.0.1:8025` catches recovery and confirmation mail in development; `SMTP_*` points production at a real server. |
| **Storage** | Buckets and objects, guarded by the same rule as rows. Signed URLs for `<img src>`. |
| **Backups** | Scheduled `pg_dump`, encrypted with a key generated for your project, plus a drill that restores one and counts what came back. |
| **Studio** | Tables with their rows, schema and row security, storage, backups, auth, logs, settings. Every setting lives here, including mail and an external object store, so you never open `baseplate.env` by hand. The one exception is the studio's own port, which would move this page out from under you: that is `baseplate dashboard --port`. |
| **TLS** | Caddy gets a Let's Encrypt certificate for your hostname when you target Hetzner. |

## Agents

`npx baseplate mcp` is the operator path for agents.
Run it from the project directory (where `baseplate.env` lives), or set `BASEPLATE_PROJECT`.
It speaks stdio JSON-RPC and never binds a port, and covers every CLI command that acts on a running project - `init` is not one of them, because the host is started inside a project that already exists.
Destructive tools need `confirm: true`.
It does not query app rows; apps use the [client](sdk/README.md).

A typical Cursor config, started with that project as cwd:

```json
{
  "mcpServers": {
    "baseplate": {
      "command": "npx",
      "args": ["baseplate", "mcp"]
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

### Who may read a table

Writes are the owner's in every mode. Reads are your choice:

| | Reads | Use it for |
| --- | --- | --- |
| `private` (default) | The caller's own rows | Notes, drafts, anything one person's |
| `shared` | Every row, to anyone signed in | Comments, a team's boards, a feed |
| `public` | Every row, no token at all | A published post, a price list, tags |

```bash
npx baseplate schema add-table posts --column title:text --access shared
npx baseplate schema set-access posts public
```

Set it when you make the table or change it later; either way it is one transaction and it applies at once.

```bash
npx baseplate tables            # what you have, and who may read each one
npx baseplate schema history    # every change your database has taken
```

## If you already keep a schema file

`schema add-table` above is the product: a schema change is a transaction against your running database, recorded there, with no file to commit and no migration to merge.

If you already run drizzle-kit, you do not have to give it up. This is an ordinary Postgres, so `drizzle-kit pull` reads what is there and `drizzle-kit push` applies your schema file. Baseplate did not create those tables, so hand each one over once:

```bash
npx baseplate schema adopt-table boards
```

That records the table, writes its policy, adds the owner trigger, and grants the app role, in one transaction. `--access` works here too. Give every table an `owner_id uuid not null` column and adopt it after each push.

[`examples/kanban`](examples/kanban) is a working board: `schema add-table` for the tables, Baseplate for login, row access, and card attachments. It used to keep a drizzle schema file and adopt it, which is why `adopt-table` exists and is tested; it does not need one.

## Files

```bash
npx baseplate storage add-bucket avatars
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
npx baseplate backup now
npx baseplate backup drills   # restores that were actually verified
npx baseplate restore <id>
```

On its own schedule the stack restores the newest backup into a scratch database and counts the tables and rows that came back. Restoring over the live database is a command, not a button, and it asks you to type the project name first.

## Testing with Playwright

Your app's end-to-end tests can run against a real stack instead of a mocked backend, so they exercise the real access rules rather than a mock's idea of them. Users are cheap: one HTTP call each, so every test can make its own and share state with nobody.

The test worth writing first is two callers against one endpoint:

```ts
test("each caller sees only their own rows", async () => {
  const alice = await signUp();
  const bob = await signUp();

  await post("/notes", alice.token, { title: "alice only" });

  expect(await get("/notes", alice.token)).toHaveLength(1);
  expect(await get("/notes", bob.token)).toHaveLength(0);
});
```

Nothing there filters by user, and nothing in your app does either. Bob gets an empty array because Postgres decided that.

[`sdk/README.md`](sdk/README.md#testing) has the working version: the `signUp`, `post`, and `get` helpers, the Playwright config that brings the stack up in `globalSetup` after a one-time `init`, signing a browser in without driving the login form, and a fixture that does it for every test.

## Going to production

> Hetzner deployment is experimental for all of `0.1.x`. Every step below is implemented, unit tested and preflighted before it runs, and none of it has yet been run against a real domain end to end. Treat the first one as a drill, not a migration.

Set the target to Hetzner in the studio's Settings. Baseplate creates a VM, a firewall, a DNS record, and a TLS certificate in **your** account, from your own API tokens.

Those tokens never leave your machine. What the server is given is what it has to use: the database and JWT secrets, the backup key and its destination credentials, and whichever mail and object store credentials you filled in. `.baseplate/stack.env` is the list, and it is the only env file that crosses.

Paste your Cloud and DNS tokens, press **Check my account**, and the region, SSH key, and DNS zone become lists read from your account rather than three names to type from memory.

Local needs no domain, no cloud account, and no certificate.

## How it compares

Baseplate is not trying to match a managed platform feature for feature. It exists so one developer running a handful of small apps can own the whole thing.

| | Baseplate | Supabase (hosted) | Rolling your own |
| --- | --- | --- | --- |
| Who holds your data | You | Supabase | You |
| Bill from this project | None | Per project | None |
| Setup | Two commands | Sign up | Days |
| Row-level security | On by default, cannot be turned off, three read modes per table | Opt in per table, any policy you write | Whatever you write |
| Realtime, edge functions, vector | No | Yes | Whatever you write |
| Dashboard | Local, on 127.0.0.1 | Hosted | None |

If you need realtime subscriptions, edge functions, or a team dashboard, use Supabase. If you want a database and an API you can point at a €5 VM and forget about, this is smaller and yours.

## Limits

Worth knowing before you trust it with something:

- **A row is written by exactly one caller.** `--access shared` and `--access public` widen who may read a table, but never who may write: there is no way to say "my team may edit this" or "whoever can see the parent may edit this". Ownership is one user, always.
- Hetzner provisioning has not been run live against a real domain yet.
- One node. No replica and no failover, so a restore is minutes of downtime.
- Auth is email and password only: no OAuth or social login, no magic links, no MFA.
- No metrics, and no alert when a backup or drill fails: it is a log line and a row.
- No point-in-time recovery. The worst case is losing up to one backup interval of writes.
- A backup is uploaded in a single request, so S3's 5 GB limit for one is the practical ceiling. Multipart upload is not implemented.

## Commands

```
init      up        down      destroy   dashboard
logs      mcp       tables    types     schema
storage   backup    restore   users     mint-token
```

Run `npx baseplate --help`, or any command with no arguments, for its own list.

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
npm run test:acceptance     # the definition of done, against this checkout
npm run test:artifact       # the same, against the packed tarball
npm run pack:check          # what is in the tarball, and how big
```

All of them pass before a pull request. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

[MIT](LICENSE) © Leander van Diepen
