import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { DomainError } from "#domain";
import { InfraError } from "#shared";
import { createOperatorFor, stackFromEnv } from "../operator-setup.ts";
import { CONFIG_FILE, packageRootFrom, projectRoot } from "../paths.ts";
import { initProject } from "./init-command.ts";
import { schemaChangeFromArgs } from "./schema-command.ts";

const PACKAGE_ROOT = packageRootFrom(import.meta.dirname);
const USAGE = `Usage: baseplate <command>

  init                     Start a project here: config, secrets, state
  up                       Bring the stack up and print the API URL
  down                     Stop the stack and destroy its volumes
  dashboard                Open the studio on 127.0.0.1
  tables                   List your tables and their columns
  schema <change>          Add, rename, or drop a table or column
  mint-token --sub UUID    Sign a caller JWT, for scripts and tests`;

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sub: { type: "string" },
      to: { type: "string" },
      column: { type: "string", multiple: true },
    },
  });
  const command = positionals[0];
  const project = projectRoot();

  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }
  if (command === "init") {
    console.log(`Wrote ${initProject(project)}. Run \`baseplate up\` next.`);
    return;
  }
  if (command === "dashboard") {
    await runDashboard(project);
    return;
  }

  const operator = createOperatorFor({ packageRoot: PACKAGE_ROOT, projectRoot: project });
  try {
    if (command === "up") {
      console.log((await operator.provision.execute(stackFromEnv())).baseUrl);
      return;
    }
    if (command === "down") {
      await operator.teardown.execute();
      return;
    }
    if (command === "tables") {
      const tables = await operator.admin.listTables();
      if (tables.length === 0) {
        console.log("No tables yet. `baseplate schema add-table <name>` makes one.");
        return;
      }
      for (const table of tables) {
        const columns = table.columns.map((column) => column.name).join(", ");
        console.log(`${table.name} (owner ${table.ownerColumn}): ${columns}`);
      }
      return;
    }
    if (command === "schema") {
      const change = schemaChangeFromArgs(positionals[1], positionals[2], {
        columns: values.column ?? [],
        to: values.to,
      });
      console.log((await operator.changeSchema.execute(change)).statement);
      return;
    }
    if (command === "mint-token") {
      if (!values.sub) {
        throw new DomainError("cli.sub_required", "mint-token requires --sub <uuid>.");
      }
      console.log(await operator.mintToken.execute(values.sub));
      return;
    }
    console.error(USAGE);
    process.exit(1);
  } finally {
    await operator.admin.close();
  }
}

/** The studio is a long-running server, so it replaces this process's job. */
function runDashboard(project: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve(PACKAGE_ROOT, "node_modules/tsx/dist/cli.mjs"),
        resolve(PACKAGE_ROOT, "src/delivery/operator-http/listen.ts"),
      ],
      { stdio: "inherit", env: { ...process.env, BASEPLATE_PROJECT: project } },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolvePromise();
        return;
      }
      reject(new InfraError("dashboard.failed", `Dashboard exited ${code}.`));
    });
  });
}

main().catch((error: unknown) => {
  if (error instanceof DomainError || error instanceof InfraError) {
    console.error(`${error.code}: ${error.message}`);
    if (error.code === "cli.missing_env_file") {
      console.error(`Looked for ${CONFIG_FILE} in ${projectRoot()}.`);
    }
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
