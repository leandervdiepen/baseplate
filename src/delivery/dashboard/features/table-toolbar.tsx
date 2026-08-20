import { useState } from "react";
import type { SchemaColumn } from "../lib/operator-client.ts";
import {
  describeFilter,
  FILTER_LABELS,
  needsValue,
  type FilterClause,
  type FilterOperator,
} from "../lib/postgrest-query.ts";
import { Button } from "../primitives/button.tsx";
import { Field, Input } from "../primitives/input.tsx";
import { Select } from "../primitives/select.tsx";

export function TableToolbar({
  table,
  ownerColumn,
  columns,
  filters,
  onFilters,
  selectedCount,
  onDelete,
  onRefresh,
  onInsert,
  onRls,
  onApi,
  onEditTable,
  busy,
}: {
  table: string;
  ownerColumn: string;
  columns: SchemaColumn[];
  filters: FilterClause[];
  onFilters: (next: FilterClause[]) => void;
  selectedCount: number;
  onDelete: () => void;
  onRefresh: () => void;
  onInsert: () => void;
  onRls: () => void;
  onApi: () => void;
  onEditTable: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 p-1.5">
        {selectedCount > 0 ? (
          <>
            <span className="ps-2 text-[length:var(--text-sm)] tabular-nums">
              {selectedCount} selected
            </span>
            <Button
              variant="danger"
              className="ms-1"
              onClick={() => setConfirming(true)}
            >
              Delete {selectedCount} {selectedCount === 1 ? "row" : "rows"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              Filter{filters.length > 0 ? ` (${String(filters.length)})` : ""}
            </Button>
            <Button variant="ghost" busy={busy} onClick={onRefresh}>
              Refresh
            </Button>
          </>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-1">
          {/* Status, not a switch. The stack applies this policy on every start
              and a table cannot opt out of it. */}
          <Button variant="ghost" onClick={onRls}>
            <span aria-hidden="true">RLS on · {ownerColumn}</span>
            <span className="sr-only">
              Row security on {table}: on, owner column {ownerColumn}. Open the details.
            </span>
          </Button>
          <Button variant="ghost" onClick={onApi}>
            API
          </Button>
          <Button variant="secondary" onClick={onEditTable}>
            Edit table
          </Button>
          <Button onClick={onInsert}>Insert row</Button>
        </div>
      </div>

      {confirming ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-danger-subtle)] p-3">
          <p className="mb-2.5 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">
            Delete {selectedCount} {selectedCount === 1 ? "row" : "rows"} from{" "}
            <span className="font-mono">{table}</span>? This runs against your database now and
            cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {open ? (
        <FilterBuilder columns={columns} filters={filters} onFilters={onFilters} />
      ) : null}

      {filters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] px-2 py-1.5">
          {filters.map((clause, index) => (
            <span
              key={`${clause.column}-${clause.operator}-${String(index)}`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-bg)] ps-2 text-[length:var(--text-xs)]"
            >
              {describeFilter(clause)}
              <button
                type="button"
                onClick={() => onFilters(filters.filter((_, at) => at !== index))}
                className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-[color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:text-[var(--color-danger)]"
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove filter {describeFilter(clause)}</span>
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterBuilder({
  columns,
  filters,
  onFilters,
}: {
  columns: SchemaColumn[];
  filters: FilterClause[];
  onFilters: (next: FilterClause[]) => void;
}) {
  const first = columns[0];
  const [column, setColumn] = useState(first?.name ?? "");
  const [operator, setOperator] = useState<FilterOperator>("eq");
  const [value, setValue] = useState("");

  const add = () => {
    const shape = columns.find((entry) => entry.name === column);
    if (!shape) {
      return;
    }
    onFilters([...filters, { column, type: shape.type, operator, value }]);
    setValue("");
  };

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] p-2"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <div className="w-40">
        <Field label="Column" hideLabel>
          <Select value={column} onChange={(event) => setColumn(event.target.value)}>
            {columns.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="w-44">
        <Field label="Condition" hideLabel>
          <Select
            value={operator}
            onChange={(event) => setOperator(event.target.value as FilterOperator)}
          >
            {FILTER_LABELS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {needsValue(operator) ? (
        <div className="w-48">
          <Field label="Value" hideLabel>
            <Input
              value={value}
              placeholder="milk"
              autoComplete="off"
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
        </div>
      ) : null}
      <Button type="submit" variant="secondary">
        Add filter
      </Button>
    </form>
  );
}
