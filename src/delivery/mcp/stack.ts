import type { Operator } from "#infrastructure";
import type { Stack } from "#domain";
import { asBoolean, objectArgs, ok, requireConfirm, type ToolResult } from "./helpers.ts";

export async function handleUp(operator: Operator, stack: Stack, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const result = await operator.provision.execute(stack, { replace: asBoolean(args, "replace") });
  return ok({ baseUrl: result.baseUrl, status: result.server.status });
}

export async function handleDown(operator: Operator): Promise<ToolResult> {
  await operator.teardown.execute({ destroy: false });
  return ok({ stopped: true });
}

export async function handleDestroy(operator: Operator, params: unknown): Promise<ToolResult> {
  requireConfirm(objectArgs(params), "destroy");
  await operator.teardown.execute({ destroy: true });
  return ok({ destroyed: true });
}
