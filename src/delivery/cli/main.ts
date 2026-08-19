import { parseArgs } from "node:util";
import { DomainError } from "#domain";
import { InfraError } from "#shared";
import {
  createOperatorFromRoot,
  repoRootFromDelivery,
  stackFromEnv,
} from "../operator-setup.ts";
import { schemaChangeFromArgs } from "./schema-command.ts";

const ROOT = repoRootFromDelivery(import.meta.dirname);
const USAGE = "Usage: baseplate <up|down|schema|tables|mint-token --sub UUID>";

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
  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }

  const operator = createOperatorFromRoot(ROOT, false);
  try {
    if (command === "up" || command === "provision") {
      const result = await operator.provision.execute(stackFromEnv());
      console.log(result.baseUrl);
      return;
    }
    if (command === "down" || command === "teardown") {
      await operator.teardown.execute();
      return;
    }
    if (command === "tables") {
      for (const table of await operator.admin.listTables()) {
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
      const result = await operator.changeSchema.execute(change);
      console.log(result.statement);
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

main().catch((error: unknown) => {
  if (error instanceof DomainError || error instanceof InfraError) {
    console.error(`${error.code}: ${error.message}`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
