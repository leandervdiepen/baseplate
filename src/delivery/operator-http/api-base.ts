import { apiBaseUrl, DomainError, parseHostname } from "#domain";

const DEFAULT_HTTP_PORT = 8080;

/**
 * Where this project's API is, from the studio's point of view.
 *
 * The studio proxies the app's own HTTP through itself so the browser talks to
 * one origin. That proxy used to go to `127.0.0.1` whatever the project was
 * pointed at, so a project targeting Hetzner would show rows and users read
 * from a local stack that happened to be on the same port. The answer looked
 * right and was about the wrong machine.
 *
 * Local means loopback and the published port. Hetzner means the hostname over
 * TLS, which is the name Caddy holds a certificate for.
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
