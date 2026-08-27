import type { IncomingMessage } from "node:http";

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1" ||
    // Any 127.x.x.x is loopback, however the socket spelled it.
    /^(::ffff:)?127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address)
  );
}

export function isLocalhostHost(host: string | undefined): boolean {
  if (!host) {
    return false;
  }
  const hostname = host.split("]")[0]?.replace(/^\[/, "").split(":")[0] ?? host;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

/**
 * Binding to 127.0.0.1 keeps the network out, not a page the operator has open:
 * a simple form post reaches localhost with no preflight. Two checks stop it,
 * either enough alone - headers a page cannot forge and a terminal never sends,
 * and a JSON content type cross-origin cannot use without a preflight this
 * server never answers. Returns the reason to refuse, or null.
 */
export function crossSiteReason(req: IncomingMessage): string | null {
  const method = req.method ?? "GET";
  const site = header(req, "sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return "That request came from another site.";
  }

  const origin = header(req, "origin");
  if (origin && !isOwnOrigin(origin, req.headers.host)) {
    return "That request came from another origin.";
  }

  if (method !== "GET" && method !== "HEAD" && hasBody(req)) {
    const type = (header(req, "content-type") ?? "").split(";")[0]?.trim();
    if (type !== "application/json") {
      return "A request with a body must be application/json.";
    }
  }
  return null;
}

function isOwnOrigin(origin: string, host: string | undefined): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && isLocalhostHost(url.host) && url.host === host;
  } catch {
    return false;
  }
}

function hasBody(req: IncomingMessage): boolean {
  const length = Number(header(req, "content-length") ?? "0");
  return length > 0 || header(req, "transfer-encoding") !== undefined;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
