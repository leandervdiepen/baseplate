export type NavId = "tables" | "schema" | "policies" | "logs" | "settings" | "auth";

export const CRUMBS: Record<NavId, { section: string; leaf: string }> = {
  tables: { section: "Tables", leaf: "rows" },
  schema: { section: "Schema", leaf: "public" },
  policies: { section: "Policies", leaf: "row access" },
  auth: { section: "Auth", leaf: "issue token" },
  logs: { section: "Logs", leaf: "all services" },
  settings: { section: "Settings", leaf: "this project" },
};
