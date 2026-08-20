import { createInterface } from "node:readline";
import type { Operator } from "#infrastructure";
import { version } from "../cli/usage.ts";
import { createOperatorFor, siteUrlFromEnv, stackFromEnv, type OperatorRoots } from "../operator-setup.ts";
import type { ToolSession } from "./handle.ts";
import { createMcpServer } from "./server.ts";

/**
 * Stdio JSON-RPC. The agent host spawns this in the project directory.
 * It never binds a port: the process talking to stdin is the only caller.
 */
export async function serveMcp(roots: OperatorRoots): Promise<void> {
  const server = createMcpServer(version(roots.packageRoot), (run) => withSession(roots, run));
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const response = await server.accept(trimmed);
    if (response) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  }
}

async function withSession<T>(
  roots: OperatorRoots,
  run: (session: ToolSession) => Promise<T>,
): Promise<T> {
  const operator = await createOperatorFor(roots);
  try {
    return await run({
      operator,
      siteUrl: siteUrlFromEnv(),
      stack: stackFromEnv(),
    });
  } finally {
    await closeOperator(operator);
  }
}

async function closeOperator(operator: Operator): Promise<void> {
  await Promise.all([
    operator.admin.close(),
    operator.storage.close(),
    operator.backups.close(),
    operator.users.close(),
  ]);
}
