export type Tool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
  };
};

const confirm = {
  type: "boolean",
  description: "Must be true. Destructive tools refuse without it.",
};

export const TOOLS: readonly Tool[] = [
  {
    name: "tables",
    description: "List tables and columns from the live database.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "types",
    description: "Print TypeScript types for the live tables. Write the result to src/database.ts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "schema",
    description:
      "Change tables on the running database. Commands: add-table, adopt-table, drop-table, rename-table, add-column, drop-column, history. drop-table and drop-column need confirm: true.",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          enum: [
            "add-table",
            "adopt-table",
            "drop-table",
            "rename-table",
            "add-column",
            "drop-column",
            "history",
          ],
        },
        table: { type: "string" },
        to: { type: "string", description: "New name for rename-table." },
        owner_column: { type: "string", description: "For adopt-table. Defaults to owner_id." },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              nullable: { type: "boolean" },
            },
            required: ["name", "type"],
          },
        },
        column: {
          type: "object",
          properties: { name: { type: "string" }, type: { type: "string" } },
          required: ["name"],
        },
        limit: { type: "number", description: "For history. Default 20." },
        confirm,
      },
    },
  },
  {
    name: "storage",
    description:
      "Buckets and objects. Commands: buckets, add-bucket, set-visibility, rm-bucket, objects. rm-bucket needs confirm: true. An app never makes a bucket.",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          enum: ["buckets", "add-bucket", "set-visibility", "rm-bucket", "objects"],
        },
        name: { type: "string" },
        visibility: { type: "string", enum: ["public", "private"] },
        public: { type: "boolean", description: "add-bucket: anyone signed in may read." },
        confirm,
      },
    },
  },
  {
    name: "users",
    description:
      "Operator accounts. Commands: list, create, delete, reset, revoke. Apps sign up through the client. delete needs confirm: true. create needs email and password (stdio cannot prompt).",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string", enum: ["list", "create", "delete", "reset", "revoke"] },
        email: { type: "string" },
        password: { type: "string" },
        id: { type: "string" },
        confirm,
      },
    },
  },
  {
    name: "backup",
    description: "Backups and drills. Commands: now, list, drill, drills.",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string", enum: ["now", "list", "drill", "drills"] },
      },
    },
  },
  {
    name: "restore",
    description: "Replace the live database with a backup. Needs confirm: true.",
    inputSchema: {
      type: "object",
      required: ["confirm"],
      properties: {
        id: { type: "number", description: "Backup id from backup list. Newest if omitted." },
        confirm,
      },
    },
  },
  {
    name: "mint-token",
    description: "Sign a caller JWT for scripts and tests. Apps sign up and log in.",
    inputSchema: {
      type: "object",
      required: ["sub"],
      properties: {
        sub: { type: "string", description: "Caller UUID." },
        ttl: { type: "string", description: "Lifetime such as 1h or 900. Default ACCESS_TOKEN_TTL." },
      },
    },
  },
  {
    name: "logs",
    description:
      "What the stack has printed, every service in one stream. Local answers over Docker, remote over SSH.",
    inputSchema: {
      type: "object",
      properties: {
        tail: { type: "number", description: "Lines from the end of each service. Default 80." },
      },
    },
  },
  {
    name: "up",
    description: "Bring the stack up and return the API URL. One stack runs at a time.",
    inputSchema: {
      type: "object",
      properties: {
        replace: { type: "boolean", description: "Stop the other stack first." },
      },
    },
  },
  {
    name: "down",
    description: "Stop the stack. Data stays.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "destroy",
    description: "Delete volumes and any server. Needs confirm: true. Cannot be undone.",
    inputSchema: {
      type: "object",
      required: ["confirm"],
      properties: { confirm },
    },
  },
];
