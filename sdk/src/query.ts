import type { TableInsert, TableName, TableRow } from "./database.ts";

export type QueryResult<T> = {
  data: T | null;
  error: Error | null;
  status: number;
};

export function createQuery<DB, T extends TableName<DB>>(
  state: { url: string; token: string | undefined },
  table: T,
) {
  return {
    async select(): Promise<QueryResult<TableRow<DB, T>[]>> {
      return request<TableRow<DB, T>[]>(state, `/${table}`, { method: "GET" });
    },
    async insert(row: TableInsert<DB, T>): Promise<QueryResult<TableRow<DB, T>>> {
      const result = await request<TableRow<DB, T>[]>(state, `/${table}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (result.error || !result.data) {
        return { data: null, error: result.error, status: result.status };
      }
      const created = result.data[0];
      if (!created) {
        return { data: null, error: new Error("Insert returned no row."), status: result.status };
      }
      return { data: created, error: null, status: result.status };
    },
  };
}

async function request<T>(
  state: { url: string; token: string | undefined },
  path: string,
  init: RequestInit,
): Promise<QueryResult<T>> {
  const headers = new Headers(init.headers);
  if (state.token) {
    headers.set("authorization", `Bearer ${state.token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${state.url}${path}`, { ...init, headers });
  if (!response.ok) {
    return {
      data: null,
      error: new Error(await readMessage(response)),
      status: response.status,
    };
  }
  return {
    data: (await response.json()) as T,
    error: null,
    status: response.status,
  };
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
