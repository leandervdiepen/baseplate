# Infra

Terraform that creates one server in the operator's Hetzner account (BYOK).
Baseplate has no cloud account.
Hetzner bills the operator.

## What it creates

- Firewall: TCP 22, 80, 443
- Server: `cx22`, Ubuntu 24.04, Docker via cloud-init
- DNS A record for the stack hostname

## Prerequisites

- Terraform CLI
- An SSH key already uploaded to Hetzner Cloud (name matches `SSH_KEY_NAME`)
- A DNS zone in Hetzner DNS (`HETZNER_DNS_ZONE`)
- Local SSH private key that matches that Hetzner key

## Operator env (TARGET=hetzner)

| Key | Purpose |
| --- | --- |
| `HCLOUD_TOKEN` | Hetzner Cloud API token |
| `HETZNER_DNS_TOKEN` | Hetzner DNS API token |
| `HETZNER_DNS_ZONE` | Zone that owns the hostname |
| `SSH_KEY_NAME` | Existing Hetzner SSH key name |
| `SERVER_LOCATION` | Default `nbg1` |
| `SITE_ADDRESS` | Must equal `stack/stack.json` hostname (Caddy TLS) |

Also set `stack/stack.json` `hostname` to an FQDN under that zone (not `localhost`).

## Commands

```bash
TARGET=hetzner ./scripts/provision
BASEPLATE_URL=https://<hostname> npm run test:acceptance
./scripts/teardown
```

State lives in `infra/` as local Terraform state (gitignored) plus `.baseplate/state.json`.
