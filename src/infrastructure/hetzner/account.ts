import type { CloudAccount, CloudAccountSnapshot } from "#application";

const CLOUD_API = "https://api.hetzner.cloud/v1";

export type HetznerAccountConfig = {
  token: string;
};

/**
 * Read-only calls against the operator's own account, from their machine with
 * their own token. DNS zones live in the Cloud API alongside servers, regions,
 * and SSH keys, so one project-scoped token is the whole account surface.
 */
export class HetznerAccount implements CloudAccount {
  constructor(private readonly config: HetznerAccountConfig) {}

  async inspect(): Promise<CloudAccountSnapshot> {
    const [locations, sshKeys, zones] = await Promise.all([
      this.cloud<{ locations: { name: string; description: string }[] }>("/locations"),
      this.cloud<{ ssh_keys: { name: string }[] }>("/ssh_keys"),
      this.cloud<{ zones: { name: string }[] }>("/zones"),
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
