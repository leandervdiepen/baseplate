# Baseplate client

The typed client for a Baseplate API. It ships inside `@diepen/baseplate`.
Agents building an app load [`skills/baseplate-app/SKILL.md`](../skills/baseplate-app/SKILL.md) from this package.
Humans keep reading this file.

```json
{ "dependencies": { "@diepen/baseplate": "^0.5.0" } }
```

```ts
import { createClient } from "@diepen/baseplate/client";

const client = createClient("http://127.0.0.1:8080");
```

## Auth

There is no public key and no anon key. `JWT_SECRET` stays on the server.
Signup, login, and password recovery are public HTTP; everything else needs the session they return.

Every auth method answers `{ data, error }` and none of them throw, so a form renders the message it gets without a `try`.

```ts
const { data, error } = await client.auth.signIn({ email, password });
if (error) {
  setMessage(error.message);
} else {
  render(data.user);
}
```

`error` is an `AuthError`: `error.code` is the server's dotted reason (`auth.invalid_credentials`, `auth.weak_password`, `auth.rate_limited`), and `error.status` is the HTTP status, or `0` when the server could not be reached at all.

```ts
await client.auth.signUp({ email, password });   // { data: { user, session }, error }
await client.auth.signIn({ email, password });
await client.auth.signOut();                     // { error }
await client.auth.refreshSession();

client.auth.getSession();                        // AuthSession | null, no await
await client.auth.getUser();                     // { data: { user }, error }
```

Signup returns `{ data: { user, session: null }, error: null }` on a stack that requires email confirmation.
The account exists; there is no session until the address is confirmed.

### Watching the session

```ts
useEffect(() => client.auth.onAuthStateChange((event, session) => setSession(session)), []);
```

`onAuthStateChange` returns the unsubscribe function itself, which is what a React effect wants to give back.
The events are:

| Event | When |
| --- | --- |
| `INITIAL_SESSION` | Once, just after you subscribe, carrying whatever session was already stored, or `null`. |
| `SIGNED_IN` | A signup, a login, a completed password reset, or another tab signing in. |
| `TOKEN_REFRESHED` | The access token was renewed, here or in another tab. |
| `USER_UPDATED` | The password changed and this session was replaced. |
| `SIGNED_OUT` | `signOut()`, or a refresh token the server refused. |

`INITIAL_SESSION` arrives asynchronously, after the call returns, so one listener covers both the first render and every change after it.
Reading `getSession()` for the initial state is fine too; it is synchronous and returns `null` when nobody is signed in.

### Passwords

```ts
await client.auth.resetPasswordForEmail(email);
```

The server always answers 200, whether or not that address has an account, so this tells you nothing to relay to the user beyond "check your email".
The email links to `{SITE_URL}/reset-password?token=...`.
That page is yours to write; read the token off the URL and finish the reset:

```ts
const token = new URL(location.href).searchParams.get("token") ?? "";
const { error } = await client.auth.confirmPasswordReset({ token, password });
```

A recovery token works once.
On success the session it returns is adopted, so the app is signed in and every other session that user had is revoked.

```ts
const { error } = await client.auth.updateUser({ currentPassword, password });
```

That is the signed-in change-password call.
It replaces this session with a fresh one and revokes the rest.

[`examples/kanban`](../examples/kanban) does the whole round trip: a "Forgot password?" control on the sign-in form and a `/reset-password` page.

### Sessions

The session is kept in `localStorage` in a browser and in memory elsewhere, so a page reload stays signed in.
Pass `{ persist: false }` for a session that dies with the process, or `{ storage }` to keep it somewhere else.

Every tab of your app shares that one stored session.
When another tab signs in, refreshes, or signs out, this client adopts what that tab wrote and emits the matching event, instead of spending its own refresh token - the server honours a refresh token once.

A timer renews the access token shortly before it expires, jittered so twenty open tabs do not all wake at the same instant.
Pass `{ autoRefresh: false }` to turn the timer off; you can then call `refreshSession()` yourself.

A query or an upload that comes back 401 refreshes once and replays itself, which covers a token that expired mid-flight or a tab that was asleep when the timer should have fired.
A refresh that fails on a dropped packet or a restarting server keeps the session and returns the error; only a refresh the server actually refuses signs you out.

Auth endpoints are rate limited per IP and per address.
A burst of failed logins earns `429` with `auth.rate_limited` and a `Retry-After` header, so show the message rather than retrying in a loop.

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
One row: `single()` errors unless exactly one matches; `maybeSingle()` returns `null` for none.

Every call returns `{ data, error, status }`. Nothing throws for an HTTP error, and nothing throws for an unreachable server.

```ts
const { data, error } = await client
  .from("notes")
  .select("id,title")
  .eq("pinned", true)
  .order("title", { ascending: false })
  .limit(20);
```

None of this filters in the client. Each filter becomes a query the database answers, and row-level security still decides what a caller can see.

## Types

Generate them from your running database:

```bash
npx @diepen/baseplate types > src/database.ts
```

```ts
import type { Database } from "./database.ts";

const client = createClient<Database>(url);
```

Then an unknown table, an unknown column, or a wrong insert shape is a compile error rather than a 400 at runtime.
Regenerate after a schema change.

## Files

```ts
await client.storage.from("avatars").upload("me.png", file);
await client.storage.from("avatars").list({ prefix: "2026/" });
await client.storage.from("avatars").download("me.png");   // a Blob
await client.storage.from("avatars").remove("me.png");
```

A bucket is the operator's to create; an app puts objects in one.
A caller sees only the objects they put there, decided by the same row-level
security that decides rows, so knowing someone else's key gets a 404.

```ts
const { data: url } = await client.storage.from("avatars").createSignedUrl("me.png", 3600);
```

That is what an `<img src>` can follow, since it cannot send an Authorization
header. It covers one object and expires.

Every call returns `{ data, error, status }`, like a query.

## Operator tokens

`npx @diepen/baseplate mint-token --sub UUID` signs a caller token directly.
It is for scripts and tests. Apps sign up and log in.
