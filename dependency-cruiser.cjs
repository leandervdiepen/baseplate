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
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
