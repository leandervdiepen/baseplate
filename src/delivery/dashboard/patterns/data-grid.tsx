import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Checkbox } from "../primitives/checkbox.tsx";

export type GridColumn = {
  key: string;
  label: string;
  /** Shown under the name, quietly: the database type. */
  meta?: string;
  /** Short marks, each already carrying its own accessible text. */
  marks?: ReactNode;
  width?: string;
  sortable?: boolean;
};

export type SortState = { column: string; direction: "asc" | "desc" } | null;

/**
 * A real table of real cells, so a screen reader pairs every value with its
 * column, and so sorting can be announced through `aria-sort` rather than by an
 * arrow nobody can read. It knows nothing about tables in a database: what a
 * cell contains is the caller's business.
 */
export function DataGrid({
  caption,
  columns,
  sort,
  onSort,
  selection,
  children,
}: {
  caption: string;
  columns: GridColumn[];
  sort?: SortState;
  onSort?: (column: string) => void;
  selection?: {
    allChecked: boolean;
    someChecked: boolean;
    onToggleAll: (checked: boolean) => void;
  };
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)]">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            {selection ? (
              <th scope="col" className="w-12 px-1">
                <Checkbox
                  checked={selection.allChecked}
                  indeterminate={!selection.allChecked && selection.someChecked}
                  label="Select every row on this page"
                  onChange={selection.onToggleAll}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                aria-sort={ariaSort(sort, column.key)}
                className="px-[var(--space-md)] py-1.5 text-start align-bottom"
              >
                <HeaderLabel column={column} sort={sort} onSort={onSort} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function HeaderLabel({
  column,
  sort,
  onSort,
}: {
  column: GridColumn;
  sort: SortState | undefined;
  onSort: ((column: string) => void) | undefined;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="truncate font-mono text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
          {column.label}
        </span>
        {column.marks}
        {sort?.column === column.key ? (
          <span aria-hidden="true" className="text-[var(--color-accent)]">
            {sort.direction === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </span>
      {column.meta ? (
        <span className="block truncate font-mono text-[length:var(--text-2xs)] font-normal text-[var(--color-text-muted)]">
          {column.meta}
        </span>
      ) : null}
    </>
  );

  if (!column.sortable || !onSort) {
    return <span className="block min-h-10 py-1.5">{inner}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className="block min-h-10 w-full rounded-[var(--radius-sm)] py-1.5 text-start transition-[color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:text-[var(--color-accent)]"
    >
      {inner}
      <span className="sr-only">{sortHint(sort, column.key)}</span>
    </button>
  );
}

export function GridRow({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--color-border)] last:border-b-0",
        selected && "bg-[var(--color-accent-subtle)]",
      )}
    >
      {children}
    </tr>
  );
}

export function GridCell({
  children,
  width,
  muted,
  mono,
  padded = true,
}: {
  children: ReactNode;
  width?: string;
  muted?: boolean;
  mono?: boolean;
  /** Off when the cell holds its own full-height control. */
  padded?: boolean;
}) {
  return (
    <td
      style={width ? { width } : undefined}
      className={cn(
        "h-10 max-w-0 truncate text-[length:var(--text-sm)] leading-[var(--leading-chip)]",
        padded && "px-[var(--space-md)]",
        muted && "text-[var(--color-text-muted)]",
        mono && "font-mono tabular-nums",
      )}
    >
      {children}
    </td>
  );
}

function ariaSort(sort: SortState | undefined, column: string): "ascending" | "descending" | "none" {
  if (sort?.column !== column) {
    return "none";
  }
  return sort.direction === "asc" ? "ascending" : "descending";
}

function sortHint(sort: SortState | undefined, column: string): string {
  if (sort?.column !== column) {
    return ", sort ascending";
  }
  return sort.direction === "asc" ? ", sort descending" : ", remove sorting";
}
