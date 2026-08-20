# Changelog

## 0.5.0

### Files, with the same rule as rows

Buckets you make, objects an app puts in them. An object is a row with bytes
attached and is guarded the same way: a private bucket shows a caller only their
own, a public one is readable by anyone signed in and writable only by whoever
put the object there. Knowing someone else's key gets a 404.

`client.storage.from(bucket)` uploads, lists, downloads, removes, and makes a
signed link for what a browser must fetch without a header.

The bytes live in a store on the compose network, never published. Point
`STORAGE_ENDPOINT` at Hetzner Object Storage, B2, or S3 instead and nothing else
changes.

### Backups that have been restored

A dump on a schedule, sealed with a key from your own config, sent to any
S3-compatible bucket you name. On its own schedule it fetches the newest one,
opens it, restores it into a database of its own, and counts the tables and rows
that came back. The studio leads with that date.

`baseplate backup now | list | drill | drills`, and `baseplate restore <id>`,
which replaces the live database and asks you to type the project name first.

### One stack at a time

Ports are the same well-known numbers in every project again. `up` refuses while
another project's stack holds them, names the directory it is in, and
`up --replace` stops it and takes over.

### One page for a table

Tables, Schema, and Policies were three destinations for one subject. Now one:
rows in an editable grid, a Data / Schema toggle for the visualizer, and row
security as a pill that opens the policy beside the data it governs.

### Fixed

- `down` ran `docker compose down -v`, so the command that reads like "stop"
  destroyed the database. It stops now; `destroy` removes volumes and asks first.
- The installed CLI never ran: it looked for tsx at a path that only exists in a
  checkout, so every command died before printing anything.
- `@diepen/baseplate/client` could not be imported outside a bundler.
- The studio answered cross-site requests, so a page you visited could have
  posted `{"destroy":true}` to it.
- Caddy matched `/auth*`, so a table named `authors` was answered by the auth
  service and 404'd.
- `CORS_ORIGIN` was read by the Caddyfile but never passed to the container, so
  setting it did nothing.
- No service had a restart policy, so a reboot left the stack down.

## 0.4.0

Baseplate is a package you install, not a repo you clone.

```
npx @diepen/baseplate init
npx @diepen/baseplate up
```

### An operator runs a system, not a codebase

Your tables live in your database. Creating, renaming, dropping, or altering one
is a single transaction there: the DDL, the row access policy, the owner trigger,
the grants, and an entry in `baseplate.schema_history`. Nothing is written to
Baseplate's files and there is nothing to commit.

A table cannot exist unprotected. The stack re-applies row access from
`baseplate.tables` on every start.

`baseplate init` creates your project: config with secrets generated for it, and
a state directory. Two projects on one machine share no ports, volumes, or
secrets.

Schema changes are available from the studio, and from `baseplate schema`.

### Queries an app can actually use

`select`, `insert`, `update`, `delete`, and the filters that make them useful:
`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`, `order`,
`limit`, `offset`, `single`, `maybeSingle`. Builders are awaitable, so a query
reads as one expression.

`baseplate types` writes TypeScript for your tables from the live database, so an
unknown column is a compile error rather than a 400.

The client never filters. Every filter becomes a query the database answers.

### Sessions that survive a reload

Sessions persist and refresh themselves before the access token expires.

Access tokens now carry `exp`. Refresh tokens are opaque, stored only as a hash,
single use, and revocable. `POST /auth/refresh` and `POST /auth/logout` are new.
Both lifetimes are configurable in the studio.

### Your cloud keys stay yours

Only database and JWT secrets are sent to a server. `HCLOUD_TOKEN` and the DNS
token never leave your machine, which is what the studio always claimed.

The studio walks the Hetzner path: it writes the hostname, derives the TLS
address from it, and checks Terraform, tokens, zone, SSH key, and hostname before
letting you provision.

### Fixed

- The API URL ignored `HTTP_PORT`, so any other port hung provisioning.
- `eq` on a value containing a comma matched nothing, because scalar filter
  values were quoted and PostgREST reads those quotes literally.

## 0.3.0

Email and password login on the stack.
`POST /auth/signup` and `POST /auth/login` issue the same JWTs PostgREST already trusts.
No public key. `JWT_SECRET` stays on the server.

## 0.2.0

Local operator dashboard on 127.0.0.1.
The browser talks to operator HTTP, not to Hetzner.

## 0.1.0

Postgres, PostgREST, and Caddy, with row-level access driven by the JWT `sub`.
Hetzner is bring-your-own-key: resources are created in the operator's project,
and Baseplate has no cloud account.

`npm run test:acceptance` is the definition of done.
Two tokens, one endpoint, disjoint rows.
