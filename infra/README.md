# Infra

Terraform that creates one server in the operator's Hetzner account (BYOK).
Baseplate has no cloud account.
Hetzner bills the operator.

## What it creates

- Firewall: TCP 22, 80, 443
- Server: `cx23`, Ubuntu 24.04, Docker via cloud-init
- DNS A and AAAA records for the stack hostname

## Prerequisites

- Terraform CLI
- An SSH key already uploaded to Hetzner Cloud (name matches `SSH_KEY_NAME`)
- A DNS zone in the same Hetzner project (`HETZNER_DNS_ZONE`)
- Local SSH private key that matches that Hetzner key

## Operator env (TARGET=hetzner)

| Key | Purpose |
| --- | --- |
| `HCLOUD_TOKEN` | Read-write token for the Hetzner project |
| `HETZNER_DNS_ZONE` | Zone that owns the hostname |
| `SSH_KEY_NAME` | Existing Hetzner SSH key name |
| `SERVER_LOCATION` | Default `nbg1` |
| `BASEPLATE_HOSTNAME` | An FQDN under that zone, not `localhost` |
| `SITE_ADDRESS` | What Caddy listens on. The hostname, so it can get a certificate |

All of them live in the operator's own `baseplate.env`, and the token never leaves their machine.
Settings in the studio writes them, checks them, and provisions from the same screen.

## Commands

```bash
npx baseplate up                                          # with TARGET=hetzner
BASEPLATE_URL=https://<hostname> npm run test:acceptance
npx baseplate destroy                                     # removes the server too
```

The first live drill passed against `baseplate.hanaflo.org` on 8 September 2026.
It created the server, firewall, DNS, and certificate, then passed the full acceptance suite through the deployed API.

## Where state lives

Nothing mutable is written here.
This directory is read-only package content: it ships with a Baseplate version and an upgrade replaces it.

Terraform runs in the project instead.
On every run Baseplate copies these files into `<project>/.baseplate/infra/` and works there, so the state, the lock file and the downloaded providers belong to one project and survive an upgrade.
Two projects on the same machine therefore cannot address each other's server.

`.baseplate/` is gitignored in full, which matters because Terraform state holds the server's details.
