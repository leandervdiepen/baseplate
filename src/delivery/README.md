CLI, localhost operator HTTP, and the dashboard.
Parses input, calls one use case, formats output.
No rules.

`GET /api/schema` merges `stack/stack.json` with live PostgREST OpenAPI (JWT role, because anon sees no tables).
When the API is down, table cards show the declared owner column only.
`GET /api/db/*` returns 503 `operator.api_down` instead of a 500 when PostgREST is unreachable.
`/api/auth/*` proxies to stack `/auth/*` so the dashboard can sign up without CORS.
