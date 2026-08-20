import { DomainError, type Stack } from "#domain";
import type { Operator } from "#infrastructure";
import { DEFAULT_ACCESS_TTL, parseTtl } from "../../../stack/shared/ttl.ts";
import { handleBackup, handleRestore } from "./backup.ts";
import { fail, objectArgs, ok, requireString, type ToolResult } from "./helpers.ts";
import { handleSchema, handleTables, handleTypes } from "./schema.ts";
import { handleDestroy, handleDown, handleUp } from "./stack.ts";
import { handleStorage } from "./storage.ts";
import { handleUsers } from "./users.ts";

export type ToolSession = {
  readonly operator: Operator;
  readonly siteUrl: string;
  readonly stack: Stack;
};

export async function callTool(name: string, params: unknown, session: ToolSession): Promise<ToolResult> {
  try {
    return await dispatch(name, params, session);
  } catch (cause) {
    if (cause instanceof DomainError) {
      return fail(cause.code, cause.message);
    }
    if (cause && typeof cause === "object" && "code" in cause && "message" in cause) {
      const coded = cause as { code: unknown; message: unknown };
      if (typeof coded.code === "string" && typeof coded.message === "string") {
        return fail(coded.code, coded.message);
      }
    }
    return fail("mcp.internal", cause instanceof Error ? cause.message : "Unknown error.");
  }
}

async function dispatch(name: string, params: unknown, session: ToolSession): Promise<ToolResult> {
  const { operator } = session;
  if (name === "tables") {
    return handleTables(operator);
  }
  if (name === "types") {
    return handleTypes(operator);
  }
  if (name === "schema") {
    return handleSchema(operator, params);
  }
  if (name === "storage") {
    return handleStorage(operator, params);
  }
  if (name === "users") {
    return handleUsers(operator, params, session.siteUrl);
  }
  if (name === "backup") {
    return handleBackup(operator, params);
  }
  if (name === "restore") {
    return handleRestore(operator, params);
  }
  if (name === "mint-token") {
    return mint(operator, params);
  }
  if (name === "up") {
    return handleUp(operator, session.stack, params);
  }
  if (name === "down") {
    return handleDown(operator);
  }
  if (name === "destroy") {
    return handleDestroy(operator, params);
  }
  throw new DomainError("mcp.unknown_tool", `Unknown tool '${name}'.`);
}

async function mint(operator: Operator, params: unknown): Promise<ToolResult> {
  const args = objectArgs(params);
  const sub = requireString(args, "sub", "cli.sub_required", "mint-token requires sub.");
  const raw = args.ttl;
  if (raw !== undefined && typeof raw !== "string") {
    throw new DomainError("mcp.invalid_ttl", "ttl must be a string such as 1h or 900.");
  }
  let ttl: number | undefined;
  if (typeof raw === "string") {
    try {
      ttl = parseTtl(raw, DEFAULT_ACCESS_TTL);
    } catch (cause) {
      throw new DomainError("mcp.invalid_ttl", cause instanceof Error ? cause.message : "Invalid ttl.");
    }
  }
  return ok(await operator.mintToken.execute(sub, ttl));
}
