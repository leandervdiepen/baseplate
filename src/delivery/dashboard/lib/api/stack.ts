import { get, post, postNothing } from "./http.ts";
import type { CloudAccountSnapshot, OperatorStatus, Overview } from "./types.ts";

export const getStatus = (): Promise<OperatorStatus> => get<OperatorStatus>("/api/status");

export const getOverview = (): Promise<Overview> => get<Overview>("/api/overview");

export const firstRunLocal = (): Promise<void> => postNothing("/api/first-run", { target: "local" });

export type ConfigSnapshot = {
  values: Record<string, string>;
  /** Whether one is stored, never the value itself. */
  secrets: Record<string, boolean>;
};

export const getConfig = (): Promise<ConfigSnapshot> => get<ConfigSnapshot>("/api/config");

export const saveConfig = (updates: Record<string, string>): Promise<void> =>
  postNothing("/api/config", updates);

/** One stack runs at a time. `replace` stops whichever other one holds the ports. */
export const provision = (replace = false): Promise<{ baseUrl: string }> =>
  post<{ baseUrl: string }>("/api/provision", { replace });

/** `destroy: false` stops the stack and keeps the data. True removes both. */
export const teardown = (destroy: boolean): Promise<void> =>
  postNothing("/api/teardown", { destroy });

export const mintToken = (sub: string): Promise<{ token: string; sub: string }> =>
  post<{ token: string; sub: string }>("/api/mint-token", { sub });

export const getLogs = async (): Promise<string> =>
  (await get<{ text: string }>("/api/logs")).text;

/** What the operator's own Hetzner account holds, read with their own tokens. */
export const getHetznerAccount = (): Promise<CloudAccountSnapshot> =>
  get<CloudAccountSnapshot>("/api/hetzner/account");
