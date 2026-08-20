import { useState } from "react";
import type { SchemaColumn } from "../lib/api/index.ts";
import { coerce, editableColumns } from "../lib/row-values.ts";
import { Button } from "../primitives/button.tsx";
import { IconPlus } from "../primitives/icon.tsx";
import { Field, Input } from "../primitives/input.tsx";

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

  return (
    <form
      className="flex flex-wrap items-end gap-[var(--space-md)]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {fields.map((field) => (
        <div key={field.name} className="w-full max-w-56">
          {/* The column name is the label. The type is the format hint, which is
              all a placeholder should ever be asked to carry. */}
          <Field label={field.name}>
            <Input
              placeholder={field.type}
              className="font-mono"
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.name]: event.target.value }))
              }
            />
          </Field>
        </div>
      ))}
      <Button type="submit" busy={busy}>
        <IconPlus />
        Insert row
      </Button>
    </form>
  );
}
