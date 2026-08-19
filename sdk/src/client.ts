import { createAuth, type AuthClient, type AuthOptions } from "./auth.ts";
import type { Database, TableName } from "./database.ts";
import { createQuery } from "./query.ts";
import type { RequestState } from "./request.ts";

export type CreateClientOptions = AuthOptions & {
  /** A caller JWT for a script or a test. Apps sign in instead. */
  token?: string;
};

export type BaseplateClient<DB> = {
  auth: AuthClient;
  from<T extends TableName<DB>>(table: T): ReturnType<typeof createQuery<DB, T>>;
};

export function createClient<DB = Database>(
  url: string,
  options: CreateClientOptions = {},
): BaseplateClient<DB> {
  const baseUrl = url.replace(/\/$/, "");
  const state: RequestState = { url: baseUrl, token: options.token };
  const auth = createAuth(
    baseUrl,
    (token) => {
      state.token = token ?? options.token;
    },
    options.token,
    options,
  );
  state.authorize = auth.authorize;
  return {
    auth,
    from<T extends TableName<DB>>(table: T) {
      return createQuery<DB, T>(state, table);
    },
  };
}
