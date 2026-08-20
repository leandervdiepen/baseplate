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
 * Binding to 127.0.0.1 keeps the network out. It does not keep out a page the
 * operator is already looking at: a form post from any site reaches localhost,
 * and a simple one needs no permission first, so `{"destroy":true}` could
 * arrive from a tab nobody meant to open.
 *
 * Two things stop that here, and either would do alone:
 *
 * `Origin` and `Sec-Fetch-Site`, which a browser attaches itself and a page
 * cannot forge. A terminal sends neither, so the CLI and curl are unaffected.
 *
 * A body must be `application/json`, which is not one of the three content
 * types a cross-origin request may use without asking permission first. Asking
 * means a preflight, and this server answers no preflight at all.
 *
 * Returns the reason to refuse, or null to go ahead.
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
