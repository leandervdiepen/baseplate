import type { CloudAccount, CloudAccountSnapshot } from "#application";

const CLOUD_API = "https://api.hetzner.cloud/v1";
const DNS_API = "https://dns.hetzner.com/api/v1";

export type HetznerAccountConfig = {
  token: string;
  dnsToken: string;
};

/**
 * Read-only calls against the operator's own account, made from their machine
 * with their own tokens. Nothing here creates or changes anything.
 *
 * The two tokens are independent, so one failing still reports what the other
 * could see. A half-configured account is the normal state while setting up.
 */
export class HetznerAccount implements CloudAccount {
  constructor(private readonly config: HetznerAccountConfig) {}

  async inspect(): Promise<CloudAccountSnapshot> {
    const [locations, sshKeys, zones] = await Promise.all([
      this.cloud<{ locations: { name: string; description: string }[] }>("/locations"),
      this.cloud<{ ssh_keys: { name: string }[] }>("/ssh_keys"),
      this.dns<{ zones: { name: string }[] }>("/zones"),
    ]);

    const cloudFailure = locations.error ?? sshKeys.error;
    return {
      cloud: cloudFailure
        ? { ok: false, message: cloudFailure }
        : { ok: true, message: "Hetzner Cloud answered." },
      dns: zones.error
        ? { ok: false, message: zones.error }
        : { ok: true, message: "Hetzner DNS answered." },
      locations: locations.data?.locations ?? [],
      sshKeys: sshKeys.data?.ssh_keys ?? [],
      zones: zones.data?.zones ?? [],
    };
  }

  private cloud<T>(path: string): Promise<Answer<T>> {
    if (!this.config.token) {
      return Promise.resolve({ error: "No Hetzner Cloud token saved yet." });
    }
    return request<T>(`${CLOUD_API}${path}`, {
      Authorization: `Bearer ${this.config.token}`,
    });
  }

  private dns<T>(path: string): Promise<Answer<T>> {
    if (!this.config.dnsToken) {
      return Promise.resolve({ error: "No Hetzner DNS token saved yet." });
    }
    return request<T>(`${DNS_API}${path}`, { "Auth-API-Token": this.config.dnsToken });
  }
}

type Answer<T> = { data?: T; error?: string };

async function request<T>(url: string, headers: Record<string, string>): Promise<Answer<T>> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) {
      return { error: "That token was rejected. Check it has read access to this account." };
    }
    if (!response.ok) {
      return { error: `Hetzner answered ${response.status}.` };
    }
    // Hetzner DNS answers a bad token with an HTML page and a 200, so a parse
    // failure here means the token, not a broken API.
    try {
      return { data: (await response.json()) as T };
    } catch {
      return { error: "That token was rejected. Check it has read access to this account." };
    }
  } catch (cause) {
    return {
      error: cause instanceof Error ? `Could not reach Hetzner: ${cause.message}` : "Could not reach Hetzner.",
    };
  }
}
