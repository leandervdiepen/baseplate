import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStack, DomainError } from "#domain";
import { InfraError } from "#shared";
import { createOperatorFromRoot, repoRootFromDelivery } from "../operator-setup.ts";

const ROOT = repoRootFromDelivery(import.meta.dirname);

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { sub: { type: "string" } },
  });
  const command = positionals[0];
  if (!command) {
    console.error("Usage: baseplate <provision|teardown|mint-token --sub UUID>");
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
  if (command === "mint-token") {
    if (!values.sub) {
      throw new DomainError("cli.sub_required", "mint-token requires --sub <uuid>.");
    }
    console.log(await operator.mintToken.execute(values.sub));
    return;
  }

  console.error("Usage: baseplate <provision|teardown|mint-token --sub UUID>");
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
