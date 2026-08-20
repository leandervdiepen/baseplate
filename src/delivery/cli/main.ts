import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { DomainError } from "#domain";
import { InfraError } from "#shared";
import { createOperatorFor, stackFromEnv } from "../operator-setup.ts";
import { CONFIG_FILE, packageRootFrom, projectRoot } from "../paths.ts";
import { initProject, portValue } from "./init-command.ts";
import { schemaChangeFromArgs, SCHEMA_USAGE } from "./schema-command.ts";
import { renderTypes } from "./types-command.ts";
import { USAGE, version } from "./usage.ts";

const PACKAGE_ROOT = packageRootFrom(import.meta.dirname);

/** Commands that need a project and a reachable database. */
const STACK_COMMANDS = new Set([
  "up",
  "down",
  "destroy",
  "tables",
  "types",
  "schema",
  "mint-token",
]);

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sub: { type: "string" },
      to: { type: "string" },
      column: { type: "string", multiple: true },
      "owner-column": { type: "string" },
      port: { type: "string" },
      "postgres-port": { type: "string" },
      "dashboard-port": { type: "string" },
      replace: { type: "boolean" },
      yes: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  const command = positionals[0];
  const project = projectRoot();

  // Help, the version, and a wrong command are all answered before a project
  // is opened. Asking someone to run `init` before they can read `--help` is
  // no way to meet them.
  if (values.version) {
    console.log(version(PACKAGE_ROOT));
    return;
  }
  if (values.help || command === "help") {
    console.log(USAGE);
    return;
  }
  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }
  if (command === "schema" && positionals[1] === undefined) {
    console.log(SCHEMA_USAGE);
    return;
  }
  if (command === "init") {
    const written = initProject(project, {
      http: portValue(values.port, "--port"),
      postgres: portValue(values["postgres-port"], "--postgres-port"),
      dashboard: portValue(values["dashboard-port"], "--dashboard-port"),
    });
    console.log(`Wrote ${written}. Run \`baseplate up\` next.`);
    return;
  }
  if (command === "dashboard") {
    await runDashboard(project, portValue(values.port, "--port"));
    return;
  }

  if (!STACK_COMMANDS.has(command)) {
    console.error(`Unknown command '${command}'.\n\n${USAGE}`);
    process.exit(1);
  }

  const operator = createOperatorFor({ packageRoot: PACKAGE_ROOT, projectRoot: project });
  try {
    if (command === "up") {
      const result = await operator.provision.execute(stackFromEnv(), {
        replace: values.replace === true,
      });
      console.log(result.baseUrl);
      return;
    }
    if (command === "down") {
      await operator.teardown.execute({ destroy: false });
      console.log("Stopped. Your data is still here; `baseplate up` brings it back.");
      return;
    }
    if (command === "destroy") {
      await confirmDestroy(project, values.yes === true);
      await operator.teardown.execute({ destroy: true });
      console.log("Destroyed: containers, volumes, and any server that was provisioned.");
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
    if (command === "types") {
      process.stdout.write(renderTypes(await operator.admin.listTables()));
      return;
    }
    if (command === "schema") {
      const change = schemaChangeFromArgs(positionals[1], positionals[2], {
        columns: values.column ?? [],
        to: values.to,
        ownerColumn: values["owner-column"],
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
  } finally {
    await operator.admin.close();
  }
}

/**
 * The only command that cannot be undone, so it asks first and wants the
 * project's name typed rather than a keystroke that could be muscle memory.
 * A pipe has nobody to ask, which is what --yes is for.
 */
async function confirmDestroy(project: string, assumeYes: boolean): Promise<void> {
  if (assumeYes) {
    return;
  }
  const name = basename(project);
  if (!process.stdin.isTTY) {
    throw new DomainError(
      "cli.confirm_required",
      "destroy deletes the database. Pass --yes when there is nobody to answer a prompt.",
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This deletes the database in ${project}, permanently.\nType '${name}' to confirm: `,
  );
  rl.close();
  if (answer.trim() !== name) {
    throw new DomainError("cli.not_confirmed", "Nothing was destroyed.");
  }
}

/** The studio is a long-running server, so it replaces this process's job. */
function runDashboard(project: string, port: number | undefined): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve(PACKAGE_ROOT, "node_modules/tsx/dist/cli.mjs"),
        resolve(PACKAGE_ROOT, "src/delivery/operator-http/listen.ts"),
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          BASEPLATE_PROJECT: project,
          ...(port === undefined ? {} : { BASEPLATE_DASHBOARD_PORT: String(port) }),
        },
      },
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
