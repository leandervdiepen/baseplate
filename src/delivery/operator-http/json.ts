import type { IncomingMessage, ServerResponse } from "node:http";
import { DomainError } from "#domain";
import { InfraError } from "#shared";

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof DomainError || error instanceof InfraError) {
    sendJson(res, 400, { code: error.code, message: error.message });
    return;
  }
  sendJson(res, 500, {
    code: "operator.internal",
    message: error instanceof Error ? error.message : "Unknown error.",
  });
}
