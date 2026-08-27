import { useState } from "react";
import { changeSchema, type ColumnType, type TableAccess } from "../lib/api/index.ts";
import { AccessChoice } from "./access-choice.tsx";
import { ColumnTypeSelect } from "./column-type-select.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card } from "../primitives/card.tsx";
import { Title } from "../primitives/heading.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

type Draft = { name: string; type: ColumnType; nullable: boolean };

const EMPTY: Draft = { name: "", type: "text", nullable: false };

export function NewTableForm({
  onDone,
  onCancel,
}: {
  onDone: (statement: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState<TableAccess>("private");
  const [columns, setColumns] = useState<Draft[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await changeSchema({
        kind: "create-table",
        table: name.trim(),
        access,
        columns: columns.filter((column) => column.name.trim().length > 0),
      });
      onDone(result.statement);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create that table.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form
        className="flex max-w-[var(--container-form)] flex-col gap-[var(--space-md)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length === 0) {
            setInvalid("Give the table a name.");
            return;
          }
          setInvalid(null);
          void submit();
        }}
      >
        <div>
          <Title>New table</Title>
          <div className="mt-1">
            <Hint>
              Every table gets an <code>id</code> and an <code>owner_id</code>.
              The owner is stamped from the caller&apos;s token on insert, and
              is what decides who may write the row.
            </Hint>
          </div>
        </div>
        <Field label="Table name" hint="Lowercase letters, digits, and underscores." error={invalid}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="notes"
            className="font-mono"
          />
        </Field>
        <AccessChoice value={access} onChange={setAccess} disabled={busy} />
        <ColumnRows columns={columns} onChange={setColumns} />
        <StatusMessage message={error} tone="error" />
        <div className="flex items-center gap-2.5">
          <Button type="submit" busy={busy}>
            Create table
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * A repeating row of controls. One visible header labels the whole column, and
 * each control carries the row number in its accessible name.
 */
function ColumnRows({
  columns,
  onChange,
}: {
  columns: Draft[];
  onChange: (next: Draft[]) => void;
}) {
  function update(index: number, patch: Partial<Draft>): void {
    onChange(columns.map((column, at) => (at === index ? { ...column, ...patch } : column)));
  }

  return (
    <fieldset className="flex flex-col gap-[var(--space-sm)] border-0 p-0">
      <legend className="mb-[var(--space-sm)] text-[length:var(--text-sm)] font-medium">
        Columns
      </legend>
      <div className="flex items-center gap-[var(--space-sm)] text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
        <span className="min-w-0 flex-1">Name</span>
        <span className="w-32 shrink-0">Type</span>
        <span className="w-20 shrink-0">Optional</span>
        <span className="w-20 shrink-0" />
      </div>
      {columns.map((column, index) => (
        <div key={index} className="flex items-center gap-[var(--space-sm)]">
          <Input
            aria-label={`Column ${index + 1} name`}
            value={column.name}
            onChange={(event) => update(index, { name: event.target.value })}
            placeholder="title"
            className="min-w-0 flex-1 font-mono"
          />
          <ColumnTypeSelect
            label={`Column ${String(index + 1)} type`}
            className="w-32 shrink-0"
            value={column.type}
            onChange={(type) => update(index, { type })}
          />
          <label className="flex min-h-10 w-20 shrink-0 cursor-pointer items-center justify-center">
            <span className="sr-only">Column {index + 1} is optional</span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={column.nullable}
              onChange={(event) => update(index, { nullable: event.target.checked })}
            />
          </label>
          <Button
            variant="ghost"
            className="w-20 shrink-0 px-2"
            onClick={() => onChange(columns.filter((_, at) => at !== index))}
            disabled={columns.length === 1}
            aria-label={`Remove column ${index + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => onChange([...columns, { ...EMPTY }])}
      >
        Add another column
      </Button>
    </fieldset>
  );
}
