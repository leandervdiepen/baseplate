import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStack, DomainError } from "#domain";
import { InfraError } from "#shared";
import { createOperatorFromRoot, repoRootFromDelivery } from "../operator-setup.ts";
import { schemaChangeFromArgs } from "./schema-command.ts";

const ROOT = repoRootFromDelivery(import.meta.dirname);
const USAGE =
  "Usage: baseplate <provision|teardown|migrate|schema|mint-token --sub UUID>";

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

  if (command === "provision") {
    const stack = createStack(
      JSON.parse(readFileSync(resolve(ROOT, "stack/stack.json"), "utf8")),
    );
    const result = await operator.provision.execute(stack);
    console.log(`${result.baseUrl}`);
    return;
  }
  if (command === "teardown") {
    await operator.teardown.execute();
    return;
  }
  if (command === "migrate") {
    await operator.applyMigrations.execute();
    return;
  }
  if (command === "schema") {
    const change = schemaChangeFromArgs(positionals[1], positionals[2], {
      columns: values.column ?? [],
      to: values.to,
    });
    const result = await operator.changeSchema.execute(change);
    console.log(
      result.applied
        ? `${result.migration} applied`
        : `${result.migration} written. Provision the stack to apply it.`,
    );
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
}

main().catch((error: unknown) => {
  if (error instanceof DomainError || error instanceof InfraError) {
    console.error(`${error.code}: ${error.message}`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
