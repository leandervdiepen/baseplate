---
name: baseplate-app
description: Guides building apps that consume a Baseplate HTTP API through `@diepen/baseplate/client`. Covers createClient, auth (signUp, signIn, signOut, getSession), queries, row-level security / RLS (never filter by owner in the client), generated types, storage, and Playwright tests against a real stack. Use when building an app against Baseplate, writing client queries, implementing signup/login, testing row access, or generating Database types.
---

# Baseplate app

For apps that consume `@diepen/baseplate/client`.
Not for developing the Baseplate package itself.

## Install

`{ "dependencies": { "@diepen/baseplate": "^0.1.0" } }`

```ts
import { createClient } from "@diepen/baseplate/client";

const client = createClient("http://127.0.0.1:8080");
```

There is no public key and no anon key.
`JWT_SECRET` stays on the server.
Signup and login are public HTTP; everything else needs the session they return.

## Auth

```ts
const { data, error } = await client.auth.signUp({ email, password });
await client.auth.signIn({ email, password });
await client.auth.signOut();

client.auth.getSession();
client.auth.onAuthStateChange((event, session) => render(session?.user));

await client.auth.resetPasswordForEmail(email);
await client.auth.confirmPasswordReset({ token, password });
await client.auth.updateUser({ currentPassword, password });
```

Auth answers `{ data, error }` like queries do; render `error.message`, never `try/catch`.
The listener gets `(event, session)` and fires once with `INITIAL_SESSION` right after subscribing.
The reset token arrives by mail as `{SITE_URL}/reset-password?token=...`; confirming it signs the user in.
The session persists in `localStorage` in a browser and in memory elsewhere, and is shared across tabs.
Refresh is automatic; do not call `refresh` yourself.
Pass `{ persist: false }` for a session that dies with the process, or `{ storage }` to keep it somewhere else.

Apps sign up and log in.
`npx baseplate mint-token --sub UUID` is for scripts and tests only.

## Queries

```ts
await client.from("notes").select();
await client.from("notes").select("id,title");
await client.from("notes").insert({ title: "hello" });
await client.from("notes").insert([{ title: "one" }, { title: "two" }]);
await client.from("notes").update({ title: "renamed" }).eq("id", id);
await client.from("notes").delete().eq("id", id);
```

Filters: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`.
Shaping: `select(columns)`, `order(column, { ascending, nullsFirst })`, `limit`, `offset`.
`single()` errors unless exactly one matches; `maybeSingle()` returns `null` for none.

Every call returns `{ data, error, status }`.
Nothing throws for an HTTP error, and nothing throws for an unreachable server.

```ts
const { data, error } = await client
  .from("notes")
  .select("id,title")
  .eq("pinned", true)
  .order("title", { ascending: false })
  .limit(20);
```

NEVER filter by user or owner in the client.
NEVER send `owner_id`.
The database stamps it and row-level security decides what a caller sees.

Every row is written by exactly one caller.
Who may *read* a table is the operator's choice of three modes, set with `schema add-table --access` or changed with `schema set-access`:

- `private` (default) - the caller's own rows only.
- `shared` - every row, to anyone signed in.
- `public` - every row, with no token at all.

So a feature where two users see one row is a `shared` table, not a workaround.
A feature where two users *edit* one row cannot be expressed: ownership is one user, always.
Say so rather than reaching for a second `owner_id`, a duplicated row, or client-side filtering - the last one does not work anyway, because the policy is in Postgres.
Files work the same way: `storage add-bucket --public` makes a bucket anyone signed in can read.

## Types

```bash
npx baseplate types > src/database.ts
```

```ts
import type { Database } from "./database.ts";

const client = createClient<Database>(url);
```

Regenerate after a schema change.

## Storage

The operator creates buckets (`baseplate storage add-bucket`).
The app uploads, lists, downloads, removes, and builds signed URLs.

```ts
await client.storage.from("avatars").upload("me.png", file);
await client.storage.from("avatars").list({ prefix: "2026/" });
await client.storage.from("avatars").download("me.png");   // a Blob
await client.storage.from("avatars").remove("me.png");

const { data: url } = await client.storage.from("avatars").createSignedUrl("me.png", 3600);
```

`createSignedUrl` is what an `<img src>` can follow.
Same RLS rule as rows: a caller sees only their objects; an unknown key is 404, not 403.

## Schema

Schema is a change against the running system, not a file in the Baseplate package.
Do not invent migration files inside `node_modules/@diepen/baseplate`.
Do not fork Baseplate.

If you are also the operator, `npx baseplate schema add-table notes --column title:text`.
That is the path to use. It needs no file and no second tool.

Only if the project already keeps a drizzle schema: `drizzle-kit push`, then `npx baseplate schema adopt-table boards` for each table, giving every one an `owner_id uuid not null` column. Adopt after each push, then regenerate types.

## Tests

Run against a real stack.
Users are cheap: one signup each.
Credential endpoints allow ten calls a minute per IP, so a large suite reuses accounts or waits out a `429` and its `Retry-After`.
The first test is two callers, one endpoint, disjoint rows.
Nothing in the test filters by user.

```ts
const alice = await signUp();
const bob = await signUp();
await post("/notes", alice.token, { title: "alice only" });
expect(await get("/notes", alice.token)).toHaveLength(1);
expect(await get("/notes", bob.token)).toHaveLength(0);
```

`baseplate init` runs once in the test project directory and refuses to run again over an existing `baseplate.env`, so it is a setup step and never part of a test run.
`baseplate up` is the repeatable half: it belongs in Playwright `globalSetup` (`execFileSync("npx", ["baseplate", "up"], { stdio: "inherit" })`), not `webServer`.
Running it against a stack that is already up is a no-op.

Skip the login form by writing the session into `localStorage` before the page loads:

```ts
import { SESSION_KEY } from "@diepen/baseplate/client";

await page.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, value),
  [SESSION_KEY, JSON.stringify({ ...session, expiresAt: Date.now() + session.expiresIn * 1000 })],
);
```

Keep one test that signs in through the form.
Files: 404, not 403.
Isolate via fresh users, not a shared reset.
`npx baseplate destroy --yes && npx baseplate up` deletes the volume; use it only on a dedicated test project.

## Operator vs app

Operator surfaces: tables, buckets, users-admin, backups, `baseplate mcp`.
App code talks to the HTTP API through the client only.
