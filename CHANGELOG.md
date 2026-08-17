# Changelog

## 0.1.0

Phase A substrate.
The repo is the system: destroy the server and rebuild from these files.

### What the operator can do

`./scripts/provision` brings up Postgres, PostgREST, and Caddy.
Default `TARGET=local` is Docker on this machine, HTTP on port 8080.
`./scripts/teardown` stops that stack.
`./scripts/mint-token --sub UUID` signs a JWT the API already trusts.

Hetzner is BYOK.
Set `TARGET=hetzner` and put your API token, DNS token, zone, and SSH key name in `operator.env`.
Resources are created in your Hetzner project.
Baseplate has no cloud account and no hosted control plane.
Hetzner bills you.

### Access model

Rows belong to the caller whose JWT `sub` matches `owner_id`.
Postgres row-level security enforces that.
No application server sits in between filtering rows.

`npm run test:acceptance` is the definition of done.
Two tokens, one endpoint, disjoint rows.
A missing token and a tampered token get nothing.

### Repo shape

Onion layers in `src/`: domain, application, infrastructure, delivery.
Declared running system in `stack/`.
Declared Hetzner server in `infra/`.
Tests in declining quantity: unit, integration, acceptance.

Linear project: https://linear.app/diepenio/project/baseplate-8380d9ef118c

### Not in this version

Authentication flows, object storage, the dashboard, backups, realtime, multi-node, and any hosted control plane.
Those are Phase B or C.
