export type OperatorStatus = {
  configured: boolean;
  target: string | null;
  hostname: string;
  siteAddress: string | null;
  dnsZone: string | null;
  sshKeyName: string | null;
  serverLocation: string | null;
  accessTokenTtl: string;
  refreshTokenTtl: string;
  baseUrl: string | null;
  apiUp: boolean;
  readiness: ReadinessCheck[];
  secrets: {
    jwt: boolean;
    hcloud: boolean;
    dnsToken: boolean;
    dnsZone: boolean;
    sshKey: boolean;
  };
};

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type ColumnType =
  | "text"
  | "integer"
  | "bigint"
  | "numeric"
  | "boolean"
  | "uuid"
  | "timestamptz"
  | "date"
  | "jsonb";

export const COLUMN_TYPES: ColumnType[] = [
  "text",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "uuid",
  "timestamptz",
  "date",
  "jsonb",
];

export type SchemaChangeBody =
  | {
      kind: "create-table";
      table: string;
      ownerColumn?: string;
      columns: { name: string; type: ColumnType; nullable: boolean }[];
    }
  | { kind: "drop-table"; table: string }
  | { kind: "rename-table"; table: string; to: string }
  | {
      kind: "add-column";
      table: string;
      column: { name: string; type: ColumnType; nullable: boolean };
    }
  | { kind: "drop-column"; table: string; column: { name: string } };

export type LiveColumn = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  references?: { table: string; column: string };
};

export type LiveTable = {
  name: string;
  ownerColumn: string;
  columns: LiveColumn[];
};

export type SchemaHistoryEntry = {
  id: number;
  change: string;
  statement: string;
  appliedAt: string;
};

export async function changeSchema(
  body: SchemaChangeBody,
): Promise<{ statement: string; tables: LiveTable[] }> {
  const response = await fetch("/api/schema", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as { statement: string; tables: LiveTable[] };
}

export async function getHistory(): Promise<SchemaHistoryEntry[]> {
  const response = await fetch("/api/history");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return ((await response.json()) as { entries: SchemaHistoryEntry[] }).entries;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function getStatus(): Promise<OperatorStatus> {
  const response = await fetch("/api/status");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as OperatorStatus;
}

export async function firstRunLocal(): Promise<void> {
  const response = await fetch("/api/first-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target: "local" }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function saveConfig(updates: Record<string, string>): Promise<void> {
  const response = await fetch("/api/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function provision(): Promise<{ baseUrl: string }> {
  const response = await fetch("/api/provision", { method: "POST" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as { baseUrl: string };
}

export async function teardown(): Promise<void> {
  const response = await fetch("/api/teardown", { method: "POST" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function mintToken(sub: string): Promise<{ token: string; sub: string }> {
  const response = await fetch("/api/mint-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sub }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as { token: string; sub: string };
}

export type AuthSession = {
  token: string;
  user: { id: string; email: string };
};

export async function signUp(email: string, password: string): Promise<AuthSession> {
  return postAuth("/api/auth/signup", email, password);
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  return postAuth("/api/auth/login", email, password);
}

async function postAuth(path: string, email: string, password: string): Promise<AuthSession> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as AuthSession;
}

export async function getLogs(): Promise<string> {
  const response = await fetch("/api/logs");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const body = (await response.json()) as { text: string };
  return body.text;
}

export type SchemaColumn = {
  name: string;
  type: string;
  primaryKey: boolean;
  owner: boolean;
  references?: { table: string; column: string };
};

export type SchemaSnapshot = {
  live: boolean;
  tables: { name: string; ownerColumn: string; columns: SchemaColumn[] }[];
};

export async function getSchema(): Promise<SchemaSnapshot> {
  const response = await fetch("/api/schema");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const body = (await response.json()) as { tables: LiveTable[]; live?: boolean };
  return {
    live: body.live !== false,
    tables: body.tables.map((table) => ({
      name: table.name,
      ownerColumn: table.ownerColumn,
      columns: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
        primaryKey: column.primaryKey,
        owner: column.name === table.ownerColumn,
        ...(column.references ? { references: column.references } : {}),
      })),
    })),
  };
}

export async function dbFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`/api/db${path}`, { ...init, headers });
}
