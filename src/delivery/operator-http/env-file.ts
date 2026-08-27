import { chmodSync, mkdirSync, writeFileSync } from "node:fs";

export const SECRET_FILE_MODE = 0o600;
export const SECRET_DIR_MODE = 0o700;

/**
 * `writeFileSync`'s `mode` applies only when it creates a file, so a rewrite
 * left whatever the umask said. Setting it again also repairs an old config.
 */
export function writeSecretFile(path: string, text: string): void {
  writeFileSync(path, text, { encoding: "utf8", mode: SECRET_FILE_MODE });
  chmodSync(path, SECRET_FILE_MODE);
}

/** Holds the stack env and Terraform state, so nobody else's business. */
export function makeSecretDir(path: string): void {
  mkdirSync(path, { recursive: true, mode: SECRET_DIR_MODE });
  chmodSync(path, SECRET_DIR_MODE);
}

export function upsertEnv(text: string, updates: Record<string, string>): string {
  const pending = new Map(Object.entries(updates));
  const lines = text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      return line;
    }
    const key = trimmed.slice(0, eq).trim();
    const next = pending.get(key);
    if (next === undefined) {
      return line;
    }
    pending.delete(key);
    return `${key}=${next}`;
  });
  for (const [key, value] of pending) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(`${key}=${value}`);
  }
  return lines.join("\n").replace(/\n*$/, "\n");
}

export function parseEnvMap(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return result;
}
