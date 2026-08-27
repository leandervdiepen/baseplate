import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { DomainError } from "#domain";
import { InfraError } from "#shared";
import { DEFAULT_ACCESS_TTL, parseTtl } from "../../../stack/shared/ttl.ts";
import { serveMcp } from "../mcp/serve.ts";
import { createOperatorFor, siteUrlFromEnv, stackFromEnv } from "../operator-setup.ts";
import { CONFIG_FILE, packageRootFrom, projectRoot } from "../paths.ts";
import { rememberProject } from "../project-directory.ts";
import { BACKUP_USAGE, runBackupCommand, runRestoreCommand } from "./backup-command.ts";
import { initProject, portValue } from "./init-command.ts";
import { schemaChangeFromArgs, SCHEMA_USAGE } from "./schema-command.ts";
import { runStorageCommand, STORAGE_USAGE } from "./storage-command.ts";
import { renderTypes } from "./types-command.ts";
import { runUsersCommand, USERS_USAGE } from "./users-command.ts";
import { STACK_COMMANDS, USAGE, version } from "./usage.ts";

const PACKAGE_ROOT = packageRootFrom(import.meta.dirname);

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sub: { type: "string" },
      to: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
      ttl: { type: "string" },
      tail: { type: "string" },
      column: { type: "string", multiple: true },
      "owner-column": { type: "string" },
      port: { type: "string" },
      "postgres-port": { type: "string" },
      "dashboard-port": { type: "string" },
      replace: { type: "boolean" },
      public: { type: "boolean" },
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
  if (command === "storage" && positionals[1] === undefined) {
    console.log(STORAGE_USAGE);
    return;
  }
  if (command === "backup" && positionals[1] === undefined) {
    console.log(BACKUP_USAGE);
    return;
  }
  if (command === "users" && positionals[1] === undefined) {
    console.log(USERS_USAGE);
    return;
  }
  if (command === "init") {
    const written = initProject(project, {
      http: portValue(values.port, "--port"),
      postgres: portValue(values["postgres-port"], "--postgres-port"),
      dashboard: portValue(values["dashboard-port"], "--dashboard-port"),
    });
    rememberProject(project);
    console.log(`Wrote ${written}. Run \`baseplate up\` next.`);
    return;
  }
  if (command === "dashboard") {
    await runDashboard(project, portValue(values.port, "--port"));
    return;
  }
  if (command === "mcp") {
    await serveMcp({ packageRoot: PACKAGE_ROOT, projectRoot: project });
    return;
  }

  if (!(STACK_COMMANDS as readonly string[]).includes(command)) {
    console.error(`Unknown command '${command}'.\n\n${USAGE}`);
    process.exit(1);
  }

  const operator = await createOperatorFor({ packageRoot: PACKAGE_ROOT, projectRoot: project });
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
    if (command === "logs") {
      const tail = values.tail === undefined ? undefined : portValue(values.tail, "--tail");
      process.stdout.write(await operator.logs.execute(tail));
      return;
    }
    if (command === "tables") {
      const tables = await operator.schema.tables();
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
      process.stdout.write(renderTypes(await operator.schema.tables()));
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
    if (command === "storage") {
      await runStorageCommand(
        operator.storage,
        positionals[1],
        positionals.slice(2),
        { makePublic: values.public === true, yes: values.yes === true },
        (line) => {
          console.log(line);
        },
      );
      return;
    }
    if (command === "backup") {
      await runBackupCommand(operator.backups, positionals[1], (line) => {
        console.log(line);
      });
      return;
    }
    if (command === "restore") {
      await runRestoreCommand(
        operator.backups,
        positionals[1],
        () => confirmRestore(project, values.yes === true),
        (line) => {
          console.log(line);
        },
      );
      return;
    }
    if (command === "users") {
      await runUsersCommand(
        operator.users,
        positionals[1],
        positionals.slice(2),
        {
          ...(values.email === undefined ? {} : { email: values.email }),
          ...(values.password === undefined ? {} : { password: values.password }),
          yes: values.yes === true,
          siteUrl: siteUrlFromEnv(),
        },
        (line) => {
          console.log(line);
        },
      );
      return;
    }
    if (command === "mint-token") {
      if (!values.sub) {
        throw new DomainError("cli.sub_required", "mint-token requires --sub <uuid>.");
      }
      const ttl = values.ttl ? parseTtl(values.ttl, DEFAULT_ACCESS_TTL) : undefined;
      console.log(await operator.mintToken.execute(values.sub, ttl));
      return;
    }
  } finally {
    await operator.close();
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

/**
 * A restore replaces the live database with an older one. Everything since that
 * backup goes, so this asks in the same words `destroy` does.
 */
async function confirmRestore(project: string, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) {
    return true;
  }
  const name = basename(project);
  if (!process.stdin.isTTY) {
    throw new DomainError(
      "cli.confirm_required",
      "restore replaces the live database. Pass --yes when there is nobody to answer a prompt.",
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This replaces the database in ${project} with the backup. Everything since it is lost.\nType '${name}' to confirm: `,
  );
  rl.close();
  return answer.trim() === name;
}

/**
 * Through `bin/baseplate-dashboard.js`, which is the one place that knows where
 * tsx is: npm hoists it, so a path under this package's node_modules is wrong
 * on a real install.
 */
function runDashboard(project: string, port: number | undefined): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(PACKAGE_ROOT, "bin/baseplate-dashboard.js")],
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
