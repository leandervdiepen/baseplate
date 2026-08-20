import { DomainError } from "#domain";

export type ToolResult = {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
};

export function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

export function fail(code: string, message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ code, message }) }],
    isError: true,
  };
}

export function asString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

export function asBoolean(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true;
}

export function asNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function requireString(
  args: Record<string, unknown>,
  key: string,
  code: string,
  message: string,
): string {
  const value = asString(args, key);
  if (!value) {
    throw new DomainError(code, message);
  }
  return value;
}

export function requireConfirm(args: Record<string, unknown>, action: string): void {
  if (!asBoolean(args, "confirm")) {
    throw new DomainError(
      "mcp.confirm_required",
      `${action} is not undoable. Call again with confirm: true.`,
    );
  }
}

export function objectArgs(params: unknown): Record<string, unknown> {
  if (params === undefined || params === null) {
    return {};
  }
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new DomainError("mcp.invalid_args", "Tool arguments must be an object.");
  }
  return params as Record<string, unknown>;
}
