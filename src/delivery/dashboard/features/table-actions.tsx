import { useState } from "react";
import { changeSchema, type ColumnType, type SchemaColumn } from "../lib/operator-client.ts";
import { TypeSelect } from "./table-editor.tsx";
import { Button } from "../primitives/button.tsx";
import { Input } from "../primitives/input.tsx";

type Pending = "add-column" | "rename" | "drop" | null;

export function TableActions({
  table,
  columns,
  onChanged,
}: {
  table: string;
  columns: SchemaColumn[];
  onChanged: (message: string) => void;
}) {
  const [open, setOpen] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<ColumnType>("text");
  const [newName, setNewName] = useState(table);

  async function run(action: () => Promise<{ statement: string }>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setOpen(null);
      setColumnName("");
      onChanged(result.statement);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change was refused.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" className="px-2" onClick={() => setOpen("add-column")}>
          Add column
        </Button>
        <Button variant="ghost" className="px-2" onClick={() => setOpen("rename")}>
          Rename
        </Button>
        <Button variant="ghost" className="px-2" onClick={() => setOpen("drop")}>
          Drop
        </Button>
      </div>

      {open === "add-column" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={columnName}
            onChange={(event) => setColumnName(event.target.value)}
            placeholder="column name"
            className="max-w-56 font-mono"
          />
          <TypeSelect value={columnType} onChange={setColumnType} />
          <Button
            disabled={busy || columnName.trim().length === 0}
            onClick={() =>
              void run(() =>
                changeSchema({
                  kind: "add-column",
                  table,
                  column: { name: columnName.trim(), type: columnType, nullable: true },
                }),
              )
            }
          >
            Add
          </Button>
          <Button variant="secondary" onClick={() => setOpen(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {open === "rename" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="max-w-56 font-mono"
          />
          <Button
            disabled={busy || newName.trim() === table}
            onClick={() =>
              void run(() =>
                changeSchema({ kind: "rename-table", table, to: newName.trim() }),
              )
            }
          >
            Rename
          </Button>
          <Button variant="secondary" onClick={() => setOpen(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {open === "drop" ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--color-danger-subtle)] p-3">
          <p className="mb-2 text-[length:var(--text-sm)]">
            Drop <span className="font-mono">{table}</span> and every row in it? This writes
            a migration, so it happens on every stack built from this repo.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void run(() => changeSchema({ kind: "drop-table", table }))}
            >
              Drop table
            </Button>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {open !== null && columns.length > 0 ? (
        <p className="mt-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          {columns.length} column{columns.length === 1 ? "" : "s"} today.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}
