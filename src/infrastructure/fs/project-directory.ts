import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { KnownProject, ProjectDirectory } from "#application";

type Entry = { root: string; lastOpenedAt: string };

/**
 * Project directories, in the operator's home because a project cannot be the
 * authority on which others exist. Paths and nothing else, so losing it costs
 * one re-open.
 */
export class FileProjectDirectory implements ProjectDirectory {
  constructor(
    private readonly file: string,
    /** So a project deleted from disk stops being offered. */
    private readonly exists: (path: string) => boolean = existsSync,
  ) {}

  async list(): Promise<readonly KnownProject[]> {
    return this.read()
      .filter((entry) => this.exists(resolve(entry.root, "baseplate.env")))
      .map((entry) => ({
        root: entry.root,
        name: basename(entry.root),
        lastOpenedAt: entry.lastOpenedAt,
      }));
  }

  async remember(root: string): Promise<void> {
    const now = new Date().toISOString();
    const others = this.read().filter((entry) => entry.root !== root);
    this.write([{ root, lastOpenedAt: now }, ...others]);
  }

  async forget(root: string): Promise<void> {
    this.write(this.read().filter((entry) => entry.root !== root));
  }

  private read(): Entry[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isEntry);
    } catch {
      // No list yet, or one somebody hand-edited into nonsense. Either way the
      // honest answer is that this operator has no remembered projects.
      return [];
    }
  }

  private write(entries: Entry[]): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
  }
}

function isEntry(value: unknown): value is Entry {
  const entry = value as Entry | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.root === "string" &&
    entry.root.length > 0 &&
    typeof entry.lastOpenedAt === "string"
  );
}
