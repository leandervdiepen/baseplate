import { useState } from "react";
import type { SchemaColumn } from "../lib/operator-client.ts";
import { coerce, editableColumns } from "../lib/row-values.ts";
import { Button } from "../primitives/button.tsx";
import { IconPlus } from "../primitives/icon.tsx";
import { Input } from "../primitives/input.tsx";

export function RowForm({
  columns,
  busy,
  onInsert,
}: {
  columns: SchemaColumn[];
  busy: boolean;
  onInsert: (values: Record<string, unknown>) => void;
}) {
  const fields = editableColumns(columns);
  const [values, setValues] = useState<Record<string, string>>({});

  function submit(): void {
    const row: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name];
      if (raw === undefined || raw === "") {
        continue;
      }
      row[field.name] = coerce(raw, field.type);
    }
    onInsert(row);
    setValues({});
  }

  if (fields.length === 0) {
    return (
      <Button onClick={submit} disabled={busy}>
        <IconPlus />
        Insert row
      </Button>
    );
  }

  return (
    <div className="flex min-h-[var(--size-control)] flex-wrap items-center gap-[var(--space-sm)]">
      {fields.map((field) => (
        <Input
          key={field.name}
          placeholder={`${field.name} (${field.type})`}
          value={values[field.name] ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, [field.name]: event.target.value }))
          }
          className="max-w-56"
        />
      ))}
      <Button onClick={submit} disabled={busy}>
        <IconPlus />
        Insert row
      </Button>
    </div>
  );
}
