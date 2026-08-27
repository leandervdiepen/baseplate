import { apiBaseUrl, DomainError, parseHostname } from "#domain";

const DEFAULT_HTTP_PORT = 8080;

/**
 * Where this project's API is, so the studio's proxy reaches the machine the
 * project is pointed at and not whatever holds the same port locally. Local is
 * loopback; Hetzner is the hostname Caddy holds a certificate for.
 */
export function apiBaseFor(env: Record<string, string | undefined>): string {
  const port = Number(env.HTTP_PORT ?? "") || DEFAULT_HTTP_PORT;
  if (env.TARGET !== "hetzner") {
    return `http://127.0.0.1:${String(port)}`;
  }
  const hostname = parseHostname(env.BASEPLATE_HOSTNAME ?? "localhost");
  if (hostname === "localhost") {
    throw new DomainError(
      "operator.hetzner_no_hostname",
      "This project targets Hetzner but has no hostname. Set one in Settings.",
    );
  }
  return apiBaseUrl(hostname, "", port);
}
