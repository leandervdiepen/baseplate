# Baseplate client

The typed client for a Baseplate API. It ships inside `@diepen/baseplate`.

```json
{ "dependencies": { "@diepen/baseplate": "^0.4.0" } }
```

```ts
import { createClient } from "@diepen/baseplate/client";

const client = createClient("http://127.0.0.1:8080");
```

## Auth

There is no public key and no anon key. `JWT_SECRET` stays on the server.
Signup and login are public HTTP; everything else needs the session they return.

```ts
await client.auth.signUp({ email, password });
await client.auth.signIn({ email, password });
await client.auth.signOut();

client.auth.getSession();
client.auth.onAuthStateChange((session) => render(session?.user));
```

The session is kept in `localStorage` in a browser and in memory elsewhere, so a page reload stays signed in.
The access token refreshes itself before it expires; you do not call `refresh` yourself.
Pass `{ persist: false }` for a session that dies with the process, or `{ storage }` to keep it somewhere else.

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

## Operator tokens

`npx @diepen/baseplate mint-token --sub UUID` signs a caller token directly.
It is for scripts and tests. Apps sign up and log in.
