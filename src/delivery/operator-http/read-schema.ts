import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnvMap } from "./env-file.ts";
import { createOperatorFromRoot } from "../operator-setup.ts";
import { mergeSchema, type SchemaSnapshot } from "./schema.ts";

const SCHEMA_INSPECT_SUB = "11111111-1111-4111-8111-111111111111";

export async function readSchema(root: string): Promise<SchemaSnapshot> {
  const stack = JSON.parse(readFileSync(resolve(root, "stack/stack.json"), "utf8")) as {
    database: { tables: { name: string; ownerColumn: string }[] };
  };
  const declared = stack.database.tables;
  const env = parseEnvMap(readFileSync(resolve(root, "operator.env"), "utf8"));
  const port = env.HTTP_PORT || "8080";
  try {
    const token = await createOperatorFromRoot(root, true).mintToken.execute(SCHEMA_INSPECT_SUB);
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      headers: {
        accept: "application/openapi+json, application/json",
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return mergeSchema(declared, null);
    }
    return mergeSchema(declared, await response.json());
  } catch {
    return mergeSchema(declared, null);
  }
}
