/**
 * What an operator's cloud account actually contains. Provisioning needs an
 * SSH key name, a region, and a DNS zone that all exist; asking someone to type
 * them from memory is how a provision fails twenty minutes in.
 */
export type CloudAccountSnapshot = {
  /** Whether each token worked, and what went wrong if it did not. */
  cloud: { ok: boolean; message: string };
  dns: { ok: boolean; message: string };
  locations: readonly { name: string; description: string }[];
  sshKeys: readonly { name: string }[];
  zones: readonly { name: string }[];
};

export type CloudAccount = {
  inspect(): Promise<CloudAccountSnapshot>;
};
