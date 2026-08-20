import type { ReactNode } from "react";
import { Checkbox } from "../primitives/checkbox.tsx";
import { HeadCell, TableFrame } from "./table.tsx";

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
 * A table you can sort and select in. Sorting is announced through `aria-sort`
 * rather than by an arrow nobody can read. It knows nothing about tables in a
 * database: what a cell contains is the caller's business.
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
    <TableFrame
      caption={caption}
      head={
        <>
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
            <HeadCell
              key={column.key}
              {...(column.width ? { width: column.width } : {})}
              {...(column.sortable ? { sorted: ariaSort(sort, column.key) } : {})}
              className="py-1.5 align-bottom"
            >
              <HeaderLabel column={column} sort={sort} onSort={onSort} />
            </HeadCell>
          ))}
        </>
      }
    >
      {children}
    </TableFrame>
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
        <SortMark active={sort?.column === column.key} direction={sort?.direction ?? "asc"} />
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

/**
 * The arrow keeps its space whether or not it is showing, so turning sorting on
 * does not shove the column name sideways.
 */
function SortMark({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex w-3 shrink-0 justify-center text-[var(--color-accent)] transition-[opacity,rotate] duration-[var(--duration-move)] ease-[var(--ease-in-out)]"
      style={{ opacity: active ? 1 : 0, rotate: active && direction === "desc" ? "180deg" : "0deg" }}
    >
      ↑
    </span>
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
