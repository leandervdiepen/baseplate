import { useState } from "react";
import {
  changeSchema,
  COLUMN_TYPES,
  type ColumnType,
  type SchemaSnapshot,
} from "../lib/operator-client.ts";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

type Draft = { name: string; type: ColumnType; nullable: boolean };

const EMPTY: Draft = { name: "", type: "text", nullable: false };

export function NewTableForm({
  onDone,
  onCancel,
}: {
  onDone: (migration: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<Draft[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await changeSchema({
        kind: "create-table",
        table: name.trim(),
        columns: columns.filter((column) => column.name.trim().length > 0),
      });
      onDone(result.statement);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the table.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
      <h2 className="mb-1 text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
        New table
      </h2>
      <Hint>
        Every table gets an <code className="font-mono">id</code> and an{" "}
        <code className="font-mono">owner_id</code>. The owner column is what row access
        matches against, so a caller only ever sees their own rows.
      </Hint>
      <div className="mt-4 flex max-w-[var(--container-form)] flex-col gap-[var(--space-md)]">
        <Field label="Table name" hint="Lowercase letters, digits, and underscores.">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="notes"
            className="font-mono"
          />
        </Field>
        <ColumnRows columns={columns} onChange={setColumns} />
        {error ? (
          <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
        ) : null}
        <div className="flex items-center gap-2.5">
          <Button onClick={() => void submit()} disabled={busy || name.trim().length === 0}>
            {busy ? "Creating…" : "Create table"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </section>
  );
}

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
    <div className="flex flex-col gap-[var(--space-sm)]">
      <span className="text-[length:var(--text-sm)] font-medium">Columns</span>
      {columns.map((column, index) => (
        <div key={index} className="flex items-center gap-[var(--space-sm)]">
          <Input
            value={column.name}
            onChange={(event) => update(index, { name: event.target.value })}
            placeholder="title"
            className="font-mono"
          />
          <TypeSelect
            value={column.type}
            onChange={(type) => update(index, { type })}
          />
          <label className="flex shrink-0 items-center gap-1.5 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={column.nullable}
              onChange={(event) => update(index, { nullable: event.target.checked })}
            />
            optional
          </label>
          <Button
            variant="ghost"
            className="shrink-0 px-2"
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
        Add column
      </Button>
    </div>
  );
}

export function TypeSelect({
  value,
  onChange,
}: {
  value: ColumnType;
  onChange: (type: ColumnType) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ColumnType)}
      className="min-h-[var(--size-control)] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 font-mono text-[length:var(--text-sm)]"
    >
      {COLUMN_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
  );
}

export function tableNames(schema: SchemaSnapshot | null): string[] {
  return (schema?.tables ?? []).map((table) => table.name);
}
