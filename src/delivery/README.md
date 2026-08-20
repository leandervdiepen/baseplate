CLI, localhost operator HTTP, and the studio.
Parses input, calls one use case, formats output.
No rules.

`GET /api/schema` reads the operator's database: `baseplate.tables` for what is
declared, and the catalog for the columns of each.
When the database is unreachable it answers `{ live: false, tables: [] }`, so a
screen can say the stack is down instead of breaking.

`/api/db/*` proxies to PostgREST with the caller's own token, so the studio sees
exactly what that caller can see and nothing more.
It returns 503 `operator.api_down` rather than a 500 when the stack is not up.

`/api/auth/*` proxies to the stack's `/auth/*` so the studio can sign up without
crossing an origin.

Every `/api/*` route is refused unless the request looks like it came from the
studio itself. See `operator-http/localhost.ts` for why binding to 127.0.0.1 is
not enough on its own.
