# Changelog

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
