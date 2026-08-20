export type NavId =
  | "tables"
  | "schema"
  | "policies"
  | "storage"
  | "logs"
  | "settings"
  | "auth";

/** The trail shown in the top bar. The leaf is a default; a page may replace it. */
export const CRUMBS: Record<NavId, { section: string; leaf: string }> = {
  tables: { section: "Tables", leaf: "no table" },
  schema: { section: "Schema", leaf: "public" },
  policies: { section: "Policies", leaf: "row access" },
  storage: { section: "Storage", leaf: "buckets" },
  auth: { section: "Auth", leaf: "sessions" },
  logs: { section: "Logs", leaf: "all services" },
  settings: { section: "Settings", leaf: "this project" },
};
