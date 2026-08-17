# Baseplate client

Typed client for the stack API this repo provisions.
It lives in this repository. It is not a hosted npm product and is not published to a registry.

Your app depends on it with a file path:

```json
{
  "dependencies": {
    "@baseplate/client": "file:../baseplate/sdk"
  }
}
```

No public key. `JWT_SECRET` stays on the server. Signup and login are public HTTP routes. After login the client holds the user JWT.

```ts
import { createClient, type Database } from "@baseplate/client";

const client = createClient<Database>("http://127.0.0.1:8080");
await client.auth.signUp({ email: "you@example.com", password: "a-long-password" });
const { data, error } = await client.from("items").select();
await client.from("items").insert({ body: "hello" });
```

Refresh table types from a running API (needs a caller JWT because anon cannot see tables):

```bash
BASEPLATE_TOKEN=$(./scripts/mint-token --sub 11111111-1111-4111-8111-111111111111) npm run sdk:types
```
