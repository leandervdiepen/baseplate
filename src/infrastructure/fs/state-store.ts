import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProvisionedStack, StackStateStore } from "#application";
import { InfraError } from "#shared";

export class FileStackStateStore implements StackStateStore {
  constructor(private readonly path: string) {}

  async save(record: ProvisionedStack): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(record, null, 2), "utf8");
  }

  async load(): Promise<ProvisionedStack | undefined> {
    try {
      const text = await readFile(this.path, "utf8");
      return JSON.parse(text) as ProvisionedStack;
    } catch (cause) {
      if (isNotFound(cause)) {
        return undefined;
      }
      throw new InfraError("state.read", "Failed to read stack state.", cause);
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.path, { force: true });
    } catch (cause) {
      throw new InfraError("state.clear", "Failed to clear stack state.", cause);
    }
  }
}

function isNotFound(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}
