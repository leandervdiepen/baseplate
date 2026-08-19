import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DomainError } from "#domain";
import { CONFIG_FILE, STATE_DIR } from "../paths.ts";
import { TEMPLATE } from "../operator-http/write-env.ts";
import { secretValue } from "../operator-http/write-env.ts";

/**
 * Creates the operator's project: a config file with freshly generated secrets
 * and a place to keep state. Nothing else, and nothing they have to maintain.
 */
export function initProject(project: string): string {
  const configPath = resolve(project, CONFIG_FILE);
  if (existsSync(configPath)) {
    throw new DomainError(
      "cli.already_initialised",
      `${CONFIG_FILE} is already here. Run \`baseplate up\` to start it.`,
    );
  }
  mkdirSync(resolve(project, STATE_DIR), { recursive: true });
  const config = TEMPLATE.replace(
    "TARGET=local",
    [
      "TARGET=local",
      "",
      `JWT_SECRET=${secretValue()}`,
      `POSTGRES_PASSWORD=${secretValue()}`,
      `AUTHENTICATOR_PASSWORD=${secretValue()}`,
      `AUTH_SERVICE_PASSWORD=${secretValue()}`,
    ].join("\n"),
  );
  writeFileSync(configPath, config, { encoding: "utf8", mode: 0o600 });
  writeFileSync(
    resolve(project, STATE_DIR, ".gitignore"),
    "*\n",
    "utf8",
  );
  return configPath;
}
