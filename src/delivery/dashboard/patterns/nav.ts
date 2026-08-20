export type NavId =
  | "overview"
  | "tables"
  | "storage"
  | "backups"
  | "auth"
  | "logs"
  | "settings";

/** The trail shown in the top bar. The leaf is a default; a page may replace it. */
export const CRUMBS: Record<NavId, { section: string; leaf: string }> = {
  overview: { section: "Overview", leaf: "this project" },
  tables: { section: "Tables", leaf: "public" },
  storage: { section: "Storage", leaf: "buckets" },
  backups: { section: "Backups", leaf: "and drills" },
  auth: { section: "Auth", leaf: "sessions" },
  logs: { section: "Logs", leaf: "all services" },
  settings: { section: "Settings", leaf: "this project" },
};
