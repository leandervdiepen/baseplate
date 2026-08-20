import { get, post } from "./http.ts";
import type {
  LiveTable,
  Problem,
  SchemaChangeBody,
  SchemaHistoryEntry,
  SchemaSnapshot,
} from "./types.ts";

export const changeSchema = (
  body: SchemaChangeBody,
): Promise<{ statement: string; tables: LiveTable[] }> =>
  post<{ statement: string; tables: LiveTable[] }>("/api/schema", body);

export const getHistory = (): Promise<{ entries: SchemaHistoryEntry[]; problem?: Problem }> =>
  get<{ entries: SchemaHistoryEntry[]; problem?: Problem }>("/api/history");

/** Marks the owner column, which is the one fact a table's own shape does not carry. */
export async function getSchema(): Promise<SchemaSnapshot> {
  const body = await get<{ tables: LiveTable[]; live?: boolean; problem?: Problem }>(
    "/api/schema",
  );
  return {
    live: body.live !== false,
    ...(body.problem ? { problem: body.problem } : {}),
    tables: body.tables.map((table) => ({
      name: table.name,
      ownerColumn: table.ownerColumn,
      columns: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
        primaryKey: column.primaryKey,
        owner: column.name === table.ownerColumn,
        nullable: column.nullable,
        hasDefault: column.hasDefault,
        ...(column.references ? { references: column.references } : {}),
      })),
    })),
  };
}

/**
 * A row read or written as a caller, not as the operator. The token decides
 * what comes back; nothing here narrows the answer afterwards.
 */
export function dbFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`/api/db${path}`, { ...init, headers });
}
