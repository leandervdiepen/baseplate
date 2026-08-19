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

`createClient<Database>(url)` takes a shape describing your tables, which gives `from()` and its columns real types.
Generate it from a running API with a caller token, because anonymous callers cannot see your tables:

```bash
BASEPLATE_TOKEN=$(npx @diepen/baseplate mint-token --sub 11111111-1111-4111-8111-111111111111) \
  npx tsx sdk/scripts/gen-types.ts
```

## Operator tokens

`npx @diepen/baseplate mint-token --sub UUID` signs a caller token directly.
It is for scripts and tests. Apps sign up and log in.
