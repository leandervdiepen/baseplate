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
| `BASEPLATE_HOSTNAME` | An FQDN under that zone, not `localhost` |
| `SITE_ADDRESS` | What Caddy listens on. The hostname, so it can get a certificate |

All of them live in the operator's own `baseplate.env`, and the two tokens never
leave their machine.
Settings in the studio writes them, checks them, and provisions from the same
screen.

## Commands

```bash
npx @diepen/baseplate up                                  # with TARGET=hetzner
BASEPLATE_URL=https://<hostname> npm run test:acceptance
npx @diepen/baseplate destroy                             # removes the server too
```

## Where state lives

Nothing mutable is written here.
This directory is read-only package content: it ships with a Baseplate version and an upgrade replaces it.

Terraform runs in the project instead.
On every run Baseplate copies these files into `<project>/.baseplate/infra/` and works there, so the state, the lock file and the downloaded providers belong to one project and survive an upgrade.
Two projects on the same machine therefore cannot address each other's server.

`.baseplate/` is gitignored in full, which matters because Terraform state holds the server's details.
