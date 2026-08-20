import * as api from "./auth-api.ts";
import { failed, ok, sessionFrom, signedOut } from "./auth-results.ts";
import { createSessionStore, REFRESH_MARGIN_MS } from "./auth-store.ts";
import {
  AuthError,
  type AuthChangeEvent,
  type AuthListener,
  type AuthResult,
  type AuthSession,
  type UserResult,
} from "./auth-types.ts";
import type { SessionStorage } from "./session-storage.ts";

export type AuthClient = {
  signUp(input: { email: string; password: string }): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<{ error: AuthError | null }>;
  /** Sends a recovery email. Answers the same way for an unknown address. */
  resetPasswordForEmail(email: string): Promise<{ data: object | null; error: AuthError | null }>;
  /** Trades a recovery token for a session, signing the user in. */
  confirmPasswordReset(input: { token: string; password: string }): Promise<AuthResult>;
  /** Changes the password. Every other session is revoked, this one is replaced. */
  updateUser(input: { currentPassword: string; password: string }): Promise<AuthResult>;
  refreshSession(): Promise<AuthResult>;
  getSession(): AuthSession | null;
  getUser(): Promise<UserResult>;
  getToken(): string | undefined;
  /** Subscribes, then reports the session it started with. Returns the unsubscribe. */
  onAuthStateChange(listener: AuthListener): () => void;
  /** The token to send now, refreshing first if the current one is about to expire. */
  authorize(): Promise<string | undefined>;
};

export type AuthOptions = {
  /** Where the session is kept. Defaults to localStorage in a browser. */
  storage?: SessionStorage;
  /** `false` keeps the session in memory only, whatever `storage` says. */
  persist?: boolean;
  /** `false` stops the background timer; the 401 retry still covers requests. */
  autoRefresh?: boolean;
};

export function createAuth(
  url: string,
  onToken: (token: string | undefined) => void,
  initialToken?: string,
  options: AuthOptions = {},
): AuthClient {
  const store = createSessionStore({
    storage: options.storage,
    persist: options.persist,
    autoRefresh: options.autoRefresh,
    onToken,
    onExpiring: () => {
      void refresh();
    },
  });
  let inFlight: Promise<AuthResult> | undefined;

  onToken(store.current()?.token ?? initialToken);

  function accept(payload: api.SessionPayload, event: AuthChangeEvent): AuthResult {
    const session = sessionFrom(payload);
    if (!session) {
      // Signup with confirmation on: a user exists, but not a session yet.
      return { data: { user: payload.user, session: null }, error: null };
    }
    store.publish(session, event);
    return ok(session);
  }

  async function refresh(): Promise<AuthResult> {
    const current = store.current();
    const newer = store.stored();
    if (
      current &&
      newer &&
      newer.refreshToken !== current.refreshToken &&
      newer.expiresAt > current.expiresAt
    ) {
      // Another tab already spent a refresh token. Spending ours would burn it.
      store.adopt(newer, "TOKEN_REFRESHED");
      return ok(newer);
    }
    if (!current?.refreshToken) {
      return signedOut();
    }
    inFlight ??= renew(current.refreshToken).finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  async function renew(refreshToken: string): Promise<AuthResult> {
    const { data, error } = await api.refresh(url, refreshToken);
    if (data) {
      return accept(data, "TOKEN_REFRESHED");
    }
    const failure = error ?? new AuthError("Could not refresh the session.", 0, "network_error");
    if (failure.status !== 401 && failure.status !== 400) {
      // A dropped packet or a restarting server is not a sign-out.
      const kept = store.current();
      return { data: { user: kept?.user ?? null, session: kept }, error: failure };
    }
    const rescue = store.stored();
    if (rescue && rescue.refreshToken !== refreshToken) {
      // We lost the race, another tab won it. Their session is good.
      store.adopt(rescue, "TOKEN_REFRESHED");
      return ok(rescue);
    }
    store.publish(null, "SIGNED_OUT");
    return { data: { user: null, session: null }, error: failure };
  }

  async function authorize(): Promise<string | undefined> {
    const session = store.current();
    if (!session) {
      return initialToken;
    }
    if (session.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
      return session.token;
    }
    const { data } = await refresh();
    return data.session?.token ?? store.current()?.token ?? initialToken;
  }

  return {
    async signUp(input) {
      const { data, error } = await api.signup(url, input);
      return data ? accept(data, "SIGNED_IN") : failed(error);
    },
    async signIn(input) {
      const { data, error } = await api.login(url, input);
      return data ? accept(data, "SIGNED_IN") : failed(error);
    },
    async signOut() {
      const refreshToken = store.current()?.refreshToken;
      store.publish(null, "SIGNED_OUT");
      if (!refreshToken) {
        return { error: null };
      }
      const { error } = await api.logout(url, refreshToken);
      return { error };
    },
    async resetPasswordForEmail(email) {
      const { error } = await api.recover(url, email);
      return error ? { data: null, error } : { data: {}, error: null };
    },
    async confirmPasswordReset(input) {
      const { data, error } = await api.recoverConfirm(url, input);
      return data ? accept(data, "SIGNED_IN") : failed(error);
    },
    async updateUser(input) {
      const token = await authorize();
      if (!token) {
        return signedOut();
      }
      const { data, error } = await api.changePassword(url, token, {
        currentPassword: input.currentPassword,
        newPassword: input.password,
      });
      return data ? accept(data, "USER_UPDATED") : failed(error);
    },
    refreshSession: refresh,
    getSession() {
      return store.current();
    },
    async getUser() {
      const token = await authorize();
      if (!token) {
        const { error } = signedOut();
        return { data: { user: null }, error };
      }
      const { data, error } = await api.me(url, token);
      if (!data?.user) {
        return {
          data: { user: null },
          error: error ?? new AuthError("The server sent no user.", 200),
        };
      }
      return { data: { user: data.user }, error: null };
    },
    getToken() {
      return store.current()?.token ?? initialToken;
    },
    onAuthStateChange(listener) {
      const unsubscribe = store.subscribe(listener);
      let live = true;
      queueMicrotask(() => {
        if (live) {
          listener("INITIAL_SESSION", store.current());
        }
      });
      return () => {
        live = false;
        unsubscribe();
      };
    },
    authorize,
  };
}
