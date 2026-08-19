import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MigrationWriter, WrittenMigration } from "#application";
import { changeSlug, type SchemaChange } from "#domain";
import { InfraError } from "#shared";
import { renderChange } from "../postgres/render-change.ts";

export class FileMigrationWriter implements MigrationWriter {
  constructor(private readonly dir: string) {}

  async write(change: SchemaChange): Promise<WrittenMigration> {
    const name = `${this.nextIndex()}_${changeSlug(change)}.sql`;
    const sql = `${renderChange(change)}\n`;
    try {
      writeFileSync(resolve(this.dir, name), sql, { encoding: "utf8", flag: "wx" });
    } catch (cause) {
      throw new InfraError(
        "migration.write_failed",
        `Could not write ${name}.`,
        cause,
      );
    }
    return { name, sql };
  }

  async remove(name: string): Promise<void> {
    rmSync(resolve(this.dir, name), { force: true });
  }

  /** Continues drizzle-kit's four-digit numbering so both authors interleave. */
  private nextIndex(): string {
    let highest = -1;
    for (const file of readdirSync(this.dir)) {
      const match = /^(\d{4})_/.exec(file);
      if (match?.[1]) {
        highest = Math.max(highest, Number(match[1]));
      }
    }
    return String(highest + 1).padStart(4, "0");
  }
}
