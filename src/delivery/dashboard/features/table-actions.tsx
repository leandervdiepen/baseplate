import { useState } from "react";
import { changeSchema, type ColumnType } from "../lib/api/index.ts";
import { ColumnTypeSelect } from "./column-type-select.tsx";
import { ConfirmInline } from "../patterns/confirm-inline.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Field, Input } from "../primitives/input.tsx";

type Pending = "add-column" | "rename" | "drop" | null;

export function TableActions({
  table,
  onOpenRows,
  onChanged,
}: {
  table: string;
  onOpenRows: () => void;
  onChanged: (message: string) => void;
}) {
  const [open, setOpen] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<ColumnType>("text");
  const [newName, setNewName] = useState(table);

  async function run(action: () => Promise<{ statement: string }>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      close();
      onChanged(result.statement);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The database refused that change.");
    } finally {
      setBusy(false);
    }
  }

  function close(): void {
    setOpen(null);
    setColumnName("");
    setNewName(table);
    setError(null);
    setInvalid(null);
  }

  /* While a form is open the triggers are hidden, so no button is ever shown
     twice and the card stays one action deep. */
  if (open === null) {
    return (
      <div className="flex flex-wrap items-center gap-1 px-3 py-2">
        <Button variant="ghost" className="px-2" onClick={onOpenRows}>
          Open rows
        </Button>
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
    );
  }

  return (
    <div className="px-3 py-3">
      {open === "add-column" ? (
        <form
          className="flex flex-col gap-[var(--space-md)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (columnName.trim().length === 0) {
              setInvalid("Give the column a name.");
              return;
            }
            setInvalid(null);
            void run(() =>
              changeSchema({
                kind: "add-column",
                table,
                column: { name: columnName.trim(), type: columnType, nullable: true },
              }),
            );
          }}
        >
          <Field
            label="Column name"
            hint="Added columns are always optional, so the rows already here stay valid."
            error={invalid}
          >
            <Input
              autoFocus
              value={columnName}
              onChange={(event) => setColumnName(event.target.value)}
              placeholder="notes"
              className="font-mono"
            />
          </Field>
          <Field label="Column type">
            <ColumnTypeSelect value={columnType} onChange={setColumnType} />
          </Field>
          <Actions confirm="Add column" busy={busy} onCancel={close} />
        </form>
      ) : null}

      {open === "rename" ? (
        <form
          className="flex flex-col gap-[var(--space-md)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (newName.trim().length === 0 || newName.trim() === table) {
              setInvalid("Give the table a different name.");
              return;
            }
            setInvalid(null);
            void run(() => changeSchema({ kind: "rename-table", table, to: newName.trim() }));
          }}
        >
          <Field
            label="New table name"
            hint="Regenerate your app's types afterwards."
            error={invalid}
          >
            <Input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="font-mono"
            />
          </Field>
          <Actions confirm="Rename table" busy={busy} onCancel={close} />
        </form>
      ) : null}

      {open === "drop" ? (
        <ConfirmInline
          confirmLabel="Drop table"
          busy={busy}
          onCancel={close}
          onConfirm={() => void run(() => changeSchema({ kind: "drop-table", table }))}
        >
          Drop <code>{table}</code> and every row in it? This runs against your database now and
          cannot be undone.
        </ConfirmInline>
      ) : null}

      <StatusMessage message={error} tone="error" className="mt-2 block" />
    </div>
  );
}

function Actions({
  confirm,
  busy,
  onCancel,
}: {
  confirm: string;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" busy={busy}>
        {confirm}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </div>
  );
}
