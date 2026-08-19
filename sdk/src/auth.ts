import { defaultStorage, SESSION_KEY, type SessionStorage } from "./storage.ts";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  token: string;
  refreshToken: string;
  /** Seconds the access token is good for, from when it was issued. */
  expiresIn: number;
  expiresAt: number;
  user: AuthUser;
};

export type AuthClient = {
  signUp(input: { email: string; password: string }): Promise<AuthSession>;
  signIn(input: { email: string; password: string }): Promise<AuthSession>;
  signOut(): Promise<void>;
  refresh(): Promise<AuthSession | undefined>;
  getSession(): AuthSession | undefined;
  getUser(): Promise<AuthUser>;
  getToken(): string | undefined;
  onAuthStateChange(listener: (session: AuthSession | undefined) => void): () => void;
  /** The token to send now, refreshing first if the current one is about to expire. */
  authorize(): Promise<string | undefined>;
};

export type AuthOptions = {
  /** Where the session is kept. Defaults to localStorage in a browser. */
  storage?: SessionStorage;
  /** `false` keeps the session in memory only, whatever `storage` says. */
  persist?: boolean;
};

/** Refresh this many seconds before expiry so a request never races the clock. */
const REFRESH_MARGIN_SECONDS = 30;

type SessionResponse = Omit<AuthSession, "expiresAt">;

export function createAuth(
  url: string,
  onToken: (token: string | undefined) => void,
  initialToken?: string,
  options: AuthOptions = {},
): AuthClient {
  const storage =
    options.persist === false ? undefined : (options.storage ?? defaultStorage());
  const listeners = new Set<(session: AuthSession | undefined) => void>();
  let session = restore(storage);
  let inFlight: Promise<AuthSession | undefined> | undefined;

  onToken(session?.token ?? initialToken);

  function publish(next: AuthSession | undefined): void {
    session = next;
    if (storage) {
      if (next) {
        storage.set(SESSION_KEY, JSON.stringify(next));
      } else {
        storage.remove(SESSION_KEY);
      }
    }
    onToken(next?.token);
    for (const listener of listeners) {
      listener(next);
    }
  }

  async function post(path: string, body: unknown): Promise<AuthSession> {
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as SessionResponse & { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? response.statusText);
    }
    const next = { ...payload, expiresAt: expiryOf(payload.expiresIn) };
    publish(next);
    return next;
  }

  async function refresh(): Promise<AuthSession | undefined> {
    if (!session?.refreshToken) {
      return undefined;
    }
    inFlight ??= post("/auth/refresh", { refreshToken: session.refreshToken })
      .catch(() => {
        publish(undefined);
        return undefined;
      })
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  }

  return {
    signUp(input) {
      return post("/auth/signup", input);
    },
    signIn(input) {
      return post("/auth/login", input);
    },
    async signOut() {
      const refreshToken = session?.refreshToken;
      publish(undefined);
      if (refreshToken) {
        await fetch(`${url}/auth/logout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }).catch(() => undefined);
      }
    },
    refresh,
    getSession() {
      return session;
    },
    async getUser() {
      const token = await authorize();
      if (!token) {
        throw new Error("Sign in first.");
      }
      const response = await fetch(`${url}/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { user?: AuthUser; message?: string };
      if (!response.ok || !payload.user) {
        throw new Error(payload.message ?? response.statusText);
      }
      return payload.user;
    },
    getToken() {
      return session?.token ?? initialToken;
    },
    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    authorize,
  };

  async function authorize(): Promise<string | undefined> {
    if (!session) {
      return initialToken;
    }
    if (session.expiresAt - REFRESH_MARGIN_SECONDS * 1000 > Date.now()) {
      return session.token;
    }
    const renewed = await refresh();
    return renewed?.token ?? session?.token ?? initialToken;
  }
}

/**
 * A server that does not report a lifetime gets the benefit of the doubt.
 * Guessing "already expired" would refresh on every single request.
 */
function expiryOf(expiresIn: number | undefined): number {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? Date.now() + expiresIn * 1000
    : Number.POSITIVE_INFINITY;
}

function restore(storage: SessionStorage | undefined): AuthSession | undefined {
  if (!storage) {
    return undefined;
  }
  const raw = storage.get(SESSION_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed.refreshToken ? parsed : undefined;
  } catch {
    storage.remove(SESSION_KEY);
    return undefined;
  }
}
