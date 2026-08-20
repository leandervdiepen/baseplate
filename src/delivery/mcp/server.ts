import { DomainError } from "#domain";
import { InfraError } from "#shared";
import { TOOLS } from "./catalog.ts";
import { callTool, type ToolSession } from "./handle.ts";
import { fail } from "./helpers.ts";
import {
  error,
  isResponse,
  noMethod,
  ok,
  parseRequest,
  type JsonRpcId,
  type JsonRpcResponse,
} from "./jsonrpc.ts";

const SUPPORTED = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);
const DEFAULT_PROTOCOL = "2024-11-05";

export type SessionOpener = <T>(run: (session: ToolSession) => Promise<T>) => Promise<T>;

export type McpServer = {
  accept(line: string): Promise<JsonRpcResponse | null>;
};

export function createMcpServer(version: string, open: SessionOpener): McpServer {
  return {
    async accept(line: string) {
      const parsed = parseRequest(line);
      if (isResponse(parsed)) {
        return parsed;
      }
      const id = parsed.id === undefined ? undefined : parsed.id;
      if (parsed.method === "notifications/initialized" || parsed.method === "initialized") {
        return id === undefined ? null : ok(id, {});
      }
      if (id === undefined) {
        return null;
      }
      return reply(id, parsed.method, parsed.params, version, open);
    },
  };
}

async function reply(
  id: JsonRpcId | null,
  method: string,
  params: unknown,
  version: string,
  open: SessionOpener,
): Promise<JsonRpcResponse> {
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: protocolOf(params),
      capabilities: { tools: {} },
      serverInfo: { name: "baseplate", version },
      instructions:
        "Operator tools for a local Baseplate project. Schema, users, storage, and backups change the running system. App code uses @diepen/baseplate/client, not these tools.",
    });
  }
  if (method === "ping") {
    return ok(id, {});
  }
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }
  if (method === "tools/call") {
    const call = parseCall(params);
    if (!call) {
      return error(id, -32602, "tools/call needs name.");
    }
    try {
      return ok(id, await open((session) => callTool(call.name, call.args, session)));
    } catch (cause) {
      if (cause instanceof DomainError || cause instanceof InfraError) {
        return ok(id, fail(cause.code, cause.message));
      }
      throw cause;
    }
  }
  return noMethod(id, method);
}

function protocolOf(params: unknown): string {
  if (typeof params === "object" && params !== null && !Array.isArray(params)) {
    const requested = (params as Record<string, unknown>).protocolVersion;
    if (typeof requested === "string" && SUPPORTED.has(requested)) {
      return requested;
    }
  }
  return DEFAULT_PROTOCOL;
}

function parseCall(params: unknown): { name: string; args: unknown } | undefined {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return undefined;
  }
  const body = params as Record<string, unknown>;
  if (typeof body.name !== "string") {
    return undefined;
  }
  return { name: body.name, args: body.arguments ?? {} };
}
