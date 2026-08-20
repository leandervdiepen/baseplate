/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-no-outward",
      comment: "Domain imports nothing outside itself.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(application|infrastructure|delivery|shared)" },
    },
    {
      name: "application-no-outward",
      comment: "Application may import domain and shared, not infrastructure or delivery.",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/(infrastructure|delivery)" },
    },
    {
      name: "infrastructure-no-delivery",
      comment: "Infrastructure does not know delivery exists.",
      severity: "error",
      from: { path: "^src/infrastructure" },
      to: { path: "^src/delivery" },
    },
    {
      name: "shared-no-dependencies",
      comment: "Shared sits beside the layers and has no domain meaning, so it depends on none of them.",
      severity: "error",
      from: { path: "^src/shared" },
      to: { path: "^src/(domain|application|infrastructure|delivery)" },
    },
    {
      name: "domain-via-index",
      comment: "Outside domain, import only src/domain/index.ts (or #domain).",
      severity: "error",
      from: { pathNot: "^src/domain" },
      to: {
        path: "^src/domain/",
        pathNot: "^src/domain/index\\.ts$",
      },
    },
    {
      name: "application-via-index",
      comment: "Outside application, import only src/application/index.ts (or #application).",
      severity: "error",
      from: { pathNot: "^src/application" },
      to: {
        path: "^src/application/",
        pathNot: "^src/application/index\\.ts$",
      },
    },
    {
      name: "infrastructure-via-index",
      comment: "Outside infrastructure, import only src/infrastructure/index.ts (or #infrastructure).",
      severity: "error",
      from: { pathNot: "^src/infrastructure" },
      to: {
        path: "^src/infrastructure/",
        pathNot: "^src/infrastructure/index\\.ts$",
      },
    },
    {
      name: "shared-via-index",
      comment: "Outside shared, import only src/shared/index.ts (or #shared).",
      severity: "error",
      from: { pathNot: "^src/shared" },
      to: {
        path: "^src/shared/",
        pathNot: "^src/shared/index\\.ts$",
      },
    },
    {
      name: "studio-patterns-know-no-product",
      comment: "A studio pattern solves a layout problem, so it cannot reach a feature.",
      severity: "error",
      from: { path: "^src/delivery/dashboard/patterns" },
      to: { path: "^src/delivery/dashboard/features" },
    },
    {
      name: "studio-primitives-know-nothing",
      comment: "A studio primitive is styled by tokens alone and reaches neither tier above it.",
      severity: "error",
      from: { path: "^src/delivery/dashboard/primitives" },
      to: { path: "^src/delivery/dashboard/(patterns|features)" },
    },
    {
      name: "studio-fetching-lives-in-features",
      comment: "Only a feature talks to the operator; a pattern or primitive that fetches is product code.",
      severity: "error",
      from: { path: "^src/delivery/dashboard/(patterns|primitives)" },
      to: { path: "^src/delivery/dashboard/lib/api" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
