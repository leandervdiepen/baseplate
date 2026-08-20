/**
 * The shapes operator HTTP sends and takes. Types only, and no I/O, so a
 * component can name what it renders without pulling the transport in with it.
 */

export type OperatorStatus = {
  configured: boolean;
  project: { name: string; path: string };
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

export type ColumnDraft = { name: string; type: ColumnType; nullable: boolean };

export type SchemaChangeBody =
  | { kind: "create-table"; table: string; ownerColumn?: string; columns: ColumnDraft[] }
  | { kind: "drop-table"; table: string }
  | { kind: "rename-table"; table: string; to: string }
  | { kind: "add-column"; table: string; column: ColumnDraft }
  | { kind: "drop-column"; table: string; column: { name: string } };

/** A column as the database describes it. */
export type LiveColumn = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  hasDefault: boolean;
  references?: { table: string; column: string };
};

export type LiveTable = {
  name: string;
  ownerColumn: string;
  columns: LiveColumn[];
};

/** The same column, with the one fact the studio adds: is this the owner. */
export type SchemaColumn = {
  name: string;
  type: string;
  primaryKey: boolean;
  owner: boolean;
  nullable: boolean;
  /** The database supplies a value when an insert leaves it out. */
  hasDefault: boolean;
  references?: { table: string; column: string };
};

export type SchemaTable = { name: string; ownerColumn: string; columns: SchemaColumn[] };

export type SchemaSnapshot = {
  live: boolean;
  tables: SchemaTable[];
};

export type SchemaHistoryEntry = {
  id: number;
  change: string;
  statement: string;
  appliedAt: string;
};

export type BucketVisibility = "private" | "public";

export type BucketSummary = {
  name: string;
  visibility: BucketVisibility;
  objects: number;
  bytes: number;
};

export type BucketList = {
  live: boolean;
  buckets: BucketSummary[];
};

export type StoredObject = {
  bucket: string;
  key: string;
  ownerId: string;
  bytes: number;
  contentType: string;
  createdAt: string;
};

export type BackupRecord = {
  id: number;
  key: string;
  bytes: number;
  destination: string;
  finishedAt: string | null;
  ok: boolean;
  message: string | null;
};

export type DrillRecord = {
  id: number;
  backupId: number | null;
  ranAt: string;
  ok: boolean;
  tables: number;
  rows: number;
  durationMs: number;
  message: string | null;
};

export type BackupState = {
  live: boolean;
  backups: BackupRecord[];
  drills: DrillRecord[];
  message?: string;
};

export type Overview = {
  live: boolean;
  tables: number;
  rowsTracked: number;
  buckets: number;
  objects: number;
  objectBytes: number;
  lastChange: { change: string; appliedAt: string } | null;
  lastBackup: { at: string; bytes: number; destination: string; ok: boolean } | null;
  lastDrill: { at: string; ok: boolean; tables: number; rows: number; durationMs: number } | null;
};

export type AuthSession = {
  token: string;
  user: { id: string; email: string };
};

export type CloudAccountSnapshot = {
  cloud: { ok: boolean; message: string };
  dns: { ok: boolean; message: string };
  locations: { name: string; description: string }[];
  sshKeys: { name: string }[];
  zones: { name: string }[];
};

export type ProjectSummary = {
  root: string;
  name: string;
  lastOpenedAt: string;
  /** Its stack is the one holding the ports. Only one can be. */
  running: boolean;
  baseUrl: string;
  /** The one this studio is serving. */
  current: boolean;
};

export type ProjectList = {
  current: string;
  projects: ProjectSummary[];
};
