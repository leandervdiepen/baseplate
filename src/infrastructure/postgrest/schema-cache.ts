import type { ApiSchemaCache } from "#application";

/** Only what this needs of `fetch`, so a test can answer without a socket. */
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

export type PostgrestSchemaCacheConfig = {
  baseUrl: string;
  /** The spec lists only what the reader may reach, so anonymous sees no tables. */
  callerToken: () => Promise<string>;
  timeoutMs?: number;
  intervalMs?: number;
  fetch?: FetchLike;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 100;
const REQUEST_TIMEOUT_MS = 2_000;

/**
 * Asks PostgREST's OpenAPI document what it is serving, because that is
 * generated from the schema cache and nothing else. A plain `GET /table` is no
 * use: reads pass through to Postgres whether the cache knows the table or not.
 */
export class PostgrestSchemaCache implements ApiSchemaCache {
  constructor(private readonly config: PostgrestSchemaCacheConfig) {}

  async waitFor(tables: readonly string[]): Promise<void> {
    if (tables.length === 0) {
      return;
    }
    let token: string;
    try {
      token = await this.config.callerToken();
    } catch {
      return;
    }
    const deadline = Date.now() + (this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const interval = this.config.intervalMs ?? DEFAULT_INTERVAL_MS;
    for (;;) {
      const served = await this.servedTables(token);
      // An API that does not answer is not going to catch up, and the change is
      // already committed. Waiting out the deadline would only make it slow.
      if (!served) {
        return;
      }
      if (tables.every((table) => served.has(table))) {
        return;
      }
      if (Date.now() >= deadline) {
        return;
      }
      await sleep(interval);
    }
  }

  private async servedTables(token: string): Promise<Set<string> | undefined> {
    const call = this.config.fetch ?? defaultFetch;
    try {
      const response = await call(this.config.baseUrl, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        return undefined;
      }
      return tableNames(await response.json());
    } catch {
      return undefined;
    }
  }
}

/** The spec's paths are `/`, one per table, and `/rpc/<function>`. */
export function tableNames(spec: unknown): Set<string> {
  const paths = (spec as { paths?: Record<string, unknown> } | null)?.paths;
  const names = new Set<string>();
  for (const path of Object.keys(paths ?? {})) {
    const name = path.startsWith("/") ? path.slice(1) : path;
    if (name.length > 0 && !name.includes("/")) {
      names.add(name);
    }
  }
  return names;
}

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}
