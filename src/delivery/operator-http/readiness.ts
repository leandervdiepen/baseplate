import { spawnSync } from "node:child_process";

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type ReadinessInput = {
  target: string;
  hostname: string;
  siteAddress: string | null;
  dnsZone: string | null;
  secrets: { hcloud: boolean; dnsToken: boolean; sshKey: boolean };
};

/**
 * What the operator would otherwise learn by reading a wiki, or by watching a
 * provision fail twenty minutes in.
 */
export function readReadiness(input: ReadinessInput): ReadinessCheck[] {
  if (input.target !== "hetzner") {
    return [
      {
        id: "docker",
        label: "Docker is running",
        ok: hasCommand("docker", ["info"]),
        detail: "Local target runs the stack in Docker on this machine.",
      },
    ];
  }
  const zone = input.dnsZone ?? "";
  const underZone =
    zone.length > 0 && (input.hostname === zone || input.hostname.endsWith(`.${zone}`));
  return [
    {
      id: "terraform",
      label: "Terraform is installed",
      ok: hasCommand("terraform", ["version"]),
      detail: "Provisioning shells out to terraform. Install it, then reload.",
    },
    {
      id: "hcloud",
      label: "Hetzner API token saved",
      ok: input.secrets.hcloud,
      detail: "A read-write token from your Hetzner Cloud console.",
    },
    {
      id: "dns",
      label: "DNS token and zone saved",
      ok: input.secrets.dnsToken && zone.length > 0,
      detail: "Add your domain as a zone in Hetzner DNS, then paste a DNS token.",
    },
    {
      id: "ssh",
      label: "SSH key name saved",
      ok: input.secrets.sshKey,
      detail: "The name of a key already uploaded to your Hetzner project.",
    },
    {
      id: "hostname",
      label: "Hostname sits under the zone",
      ok: underZone,
      detail: zone
        ? `Hostname must be ${zone} or something under it.`
        : "Set a DNS zone first.",
    },
    {
      id: "site",
      label: "TLS address matches the hostname",
      ok: input.siteAddress === input.hostname && input.hostname !== "localhost",
      detail: "Caddy asks Let's Encrypt for exactly this name.",
    },
    {
      id: "ssh",
      label: "ssh and rsync are installed",
      ok: hasCommand("ssh", ["-V"]) && hasCommand("rsync", ["--version"]),
      detail:
        "The stack is copied to the server and run over SSH, and the database is reached through a tunnel.",
    },
  ];
}


function hasCommand(command: string, args: string[]): boolean {
  try {
    return spawnSync(command, args, { stdio: "ignore", timeout: 5_000 }).status === 0;
  } catch {
    return false;
  }
}
