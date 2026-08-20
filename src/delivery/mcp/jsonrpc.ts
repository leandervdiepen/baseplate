export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  readonly jsonrpc: "2.0";
  readonly id?: JsonRpcId | null;
  readonly method: string;
  readonly params?: unknown;
};

export type JsonRpcResponse =
  | { readonly jsonrpc: "2.0"; readonly id: JsonRpcId | null; readonly result: unknown }
  | {
      readonly jsonrpc: "2.0";
      readonly id: JsonRpcId | null;
      readonly error: { readonly code: number; readonly message: string };
    };

const PARSE = -32700;
const INVALID = -32600;
const NO_METHOD = -32601;

export function parseRequest(line: string): JsonRpcRequest | JsonRpcResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return error(null, PARSE, "Parse error");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return error(null, INVALID, "Request must be a JSON object.");
  }
  const body = parsed as Record<string, unknown>;
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return error(idOf(body.id), INVALID, "Not a JSON-RPC 2.0 request.");
  }
  return {
    jsonrpc: "2.0",
    method: body.method,
    ...(body.id === undefined ? {} : { id: idOf(body.id) }),
    ...(body.params === undefined ? {} : { params: body.params }),
  };
}

export function ok(id: JsonRpcId | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function error(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function noMethod(id: JsonRpcId | null, method: string): JsonRpcResponse {
  return error(id, NO_METHOD, `Unknown method '${method}'.`);
}

export function isResponse(value: JsonRpcRequest | JsonRpcResponse): value is JsonRpcResponse {
  return "result" in value || "error" in value;
}

function idOf(raw: unknown): JsonRpcId | null {
  return typeof raw === "string" || typeof raw === "number" ? raw : null;
}
