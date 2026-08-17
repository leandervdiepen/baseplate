import { createAuth, type AuthClient } from "./auth.ts";
import type { Database, TableName } from "./database.ts";
import { createQuery } from "./query.ts";

export type CreateClientOptions = {
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
  const state = { url: baseUrl, token: options.token };
  const auth = createAuth(baseUrl, (token) => {
    state.token = token;
  }, options.token);
  return {
    auth,
    from<T extends TableName<DB>>(table: T) {
      return createQuery<DB, T>(state, table);
    },
  };
}
