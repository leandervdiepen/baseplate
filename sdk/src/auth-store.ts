import type { AuthChangeEvent, AuthListener, AuthSession } from "./auth-types.ts";
import { defaultStorage, SESSION_KEY, type SessionStorage } from "./session-storage.ts";

/** Refresh this many milliseconds before expiry so a request never races the clock. */
export const REFRESH_MARGIN_MS = 30_000;

/** Spread the proactive refresh of many tabs so they do not all wake together. */
const REFRESH_JITTER_MS = 10_000;

export type SessionStoreOptions = {
  storage?: SessionStorage | undefined;
  persist?: boolean | undefined;
  autoRefresh?: boolean | undefined;
  onToken: (token: string | undefined) => void;
  /** Called when the access token is about to expire on its own timer. */
  onExpiring: () => void;
};

export type SessionStore = {
  current(): AuthSession | null;
  /** What storage holds right now, which another tab may have changed. */
  stored(): AuthSession | null;
  /** Ours: written to storage, then announced. */
  publish(next: AuthSession | null, event: AuthChangeEvent): void;
  /** Somebody else's: held in memory and announced, never written back. */
  adopt(next: AuthSession | null, event: AuthChangeEvent): void;
  subscribe(listener: AuthListener): () => void;
};

/**
 * The session as shared state: one copy in memory, one in storage, and other
 * tabs writing to the same storage. Whoever refreshed last wins, because the
 * server spends a refresh token on first use.
 */
export function createSessionStore(options: SessionStoreOptions): SessionStore {
  const storage = options.persist === false ? undefined : options.storage ?? defaultStorage();
  const listeners = new Set<AuthListener>();
  let session = read(storage);
  let timer: unknown;

  storage?.onExternalChange?.((raw) => {
    const next = parse(raw);
    if (!next) {
      if (session) {
        hand(null, "SIGNED_OUT");
      }
      return;
    }
    if (next.token === session?.token) {
      return;
    }
    hand(next, session ? "TOKEN_REFRESHED" : "SIGNED_IN");
  });

  function hand(next: AuthSession | null, event: AuthChangeEvent): void {
    session = next;
    options.onToken(next?.token);
    schedule();
    for (const listener of [...listeners]) {
      listener(event, next);
    }
  }

  function schedule(): void {
    const clear = globalThis.clearTimeout;
    if (timer !== undefined && typeof clear === "function") {
      clear(timer as ReturnType<typeof setTimeout>);
    }
    timer = undefined;
    const set = globalThis.setTimeout;
    const expiresAt = session?.expiresAt;
    if (
      options.autoRefresh === false ||
      typeof set !== "function" ||
      expiresAt === undefined ||
      !Number.isFinite(expiresAt)
    ) {
      return;
    }
    const delay = Math.max(
      0,
      expiresAt - Date.now() - REFRESH_MARGIN_MS - Math.random() * REFRESH_JITTER_MS,
    );
    const handle: unknown = set(() => {
      timer = undefined;
      options.onExpiring();
    }, delay);
    (handle as { unref?: () => void }).unref?.();
    timer = handle;
  }

  schedule();

  return {
    current() {
      return session;
    },
    stored() {
      return read(storage);
    },
    publish(next, event) {
      if (storage) {
        if (next) {
          storage.set(SESSION_KEY, JSON.stringify(next));
        } else {
          storage.remove(SESSION_KEY);
        }
      }
      hand(next, event);
    },
    adopt(next, event) {
      hand(next, event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function read(storage: SessionStorage | undefined): AuthSession | null {
  if (!storage) {
    return null;
  }
  const raw = storage.get(SESSION_KEY);
  const parsed = parse(raw);
  if (raw && !parsed) {
    storage.remove(SESSION_KEY);
  }
  return parsed;
}

function parse(raw: string | null): AuthSession | null {
  if (!raw) {
    return null;
  }
  try {
    const candidate = JSON.parse(raw) as AuthSession;
    return candidate?.refreshToken && candidate.token ? candidate : null;
  } catch {
    return null;
  }
}
