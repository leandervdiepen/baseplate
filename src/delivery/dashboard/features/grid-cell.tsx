import { useState } from "react";
import { shortId } from "../lib/format.ts";
import type { SchemaColumn } from "../lib/api/index.ts";
import { coerce } from "../lib/row-values.ts";
import { Field, Input } from "../primitives/input.tsx";
import { Select } from "../primitives/select.tsx";

export function display(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/**
 * One value, readable until clicked. Identifiers and the owner column are shown
 * and never editable: the database sets the owner from the token, so such a
 * field would have every save refused.
 */
export function EditableCell({
  column,
  value,
  rowLabel,
  onCommit,
}: {
  column: SchemaColumn;
  value: unknown;
  rowLabel: string;
  onCommit: (next: unknown) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = display(value);
  const fixed = column.primaryKey || column.owner;

  if (fixed) {
    return (
      <span
        title={shown}
        className="block truncate px-[var(--space-md)] font-mono text-[length:var(--text-sm)] tabular-nums text-[var(--color-text-muted)]"
      >
        {shown.length > 12 ? shortId(shown) : shown}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(shown);
          setEditing(true);
        }}
        title={shown}
        className="block h-10 w-full cursor-text truncate px-[var(--space-md)] text-start text-[length:var(--text-sm)] transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-[var(--color-bg-subtle)]"
      >
        {shown === "" ? (
          <span className="text-[var(--color-text-muted)]">null</span>
        ) : (
          <span className={column.type === "boolean" ? "font-mono" : undefined}>{shown}</span>
        )}
        <span className="sr-only">
          , edit {column.name} for {rowLabel}
        </span>
      </button>
    );
  }

  const finish = (raw: string | null) => {
    setEditing(false);
    if (raw === null) {
      return;
    }
    // An emptied nullable column means null. A column that cannot be null keeps
    // the empty string, and the database says why if it objects.
    const next = raw === "" && column.nullable ? null : coerce(raw, column.type);
    void onCommit(next);
  };

  return (
    <div className="px-1.5 py-1">
      <Field label={`${column.name} for ${rowLabel}`} hideLabel>
        {column.type === "boolean" ? (
          <Select
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => finish(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditing(false);
              }
            }}
          >
            <option value="true">true</option>
            <option value="false">false</option>
            {column.nullable ? <option value="">null</option> : null}
          </Select>
        ) : (
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => finish(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                finish(event.currentTarget.value);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setEditing(false);
              }
            }}
          />
        )}
      </Field>
    </div>
  );
}
