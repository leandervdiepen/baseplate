import { shortId } from "../lib/format.ts";
import type { SchemaColumn, TableAccess } from "../lib/api/index.ts";
import { DataGrid, type SortState } from "../patterns/data-grid.tsx";
import { Cell, Row as GridRow } from "../patterns/table.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { Button } from "../primitives/button.tsx";
import { Checkbox } from "../primitives/checkbox.tsx";
import { StatusPill } from "../primitives/chip.tsx";
import { ACCESS_SUMMARY } from "./access-choice.tsx";
import { EditableCell } from "./grid-cell.tsx";
import type { Row } from "./use-table-rows.ts";

/**
 * The rows a caller can see, and only those. Every filter, sort, and page is a
 * question the database answers; nothing here narrows a result after the fact.
 */
export function TableGrid({
  table,
  access,
  columns,
  rows,
  primaryKey,
  sort,
  onSort,
  selected,
  onSelect,
  onEdit,
  total,
  offset,
  limit,
  onPage,
  filtered,
}: {
  table: string;
  access: TableAccess;
  columns: SchemaColumn[];
  rows: Row[];
  primaryKey: string | null;
  sort: SortState;
  onSort: (column: string) => void;
  selected: Set<string>;
  onSelect: (next: Set<string>) => void;
  onEdit: (row: Row, column: SchemaColumn, value: unknown) => Promise<void>;
  total: number | null;
  offset: number;
  limit: number;
  onPage: (offset: number) => void;
  filtered: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={filtered ? "Nothing matches those filters" : "No rows yet"}
        description={
          filtered
            ? "The database answered with nothing. Remove a filter to widen the question."
            : `Insert the first row into public.${table}. ${ACCESS_SUMMARY[access]}`
        }
      />
    );
  }

  const keyOf = (row: Row, index: number): string =>
    primaryKey ? String(row[primaryKey] ?? index) : String(index);
  const pageKeys = rows.map(keyOf);
  const allChecked = pageKeys.every((key) => selected.has(key));

  return (
    <>
      <DataGrid
        caption={`Rows in public.${table} visible to this caller`}
        sort={sort}
        onSort={onSort}
        columns={columns.map((column) => ({
          key: column.name,
          label: column.name,
          meta: column.type,
          sortable: true,
          marks: <ColumnMarks column={column} />,
          ...(column.primaryKey || column.owner ? { width: "var(--size-col-id)" } : {}),
        }))}
        {...(primaryKey
          ? {
              selection: {
                allChecked,
                someChecked: pageKeys.some((key) => selected.has(key)),
                onToggleAll: (checked: boolean) => {
                  const next = new Set(selected);
                  for (const key of pageKeys) {
                    if (checked) {
                      next.add(key);
                    } else {
                      next.delete(key);
                    }
                  }
                  onSelect(next);
                },
              },
            }
          : {})}
      >
        {rows.map((row, index) => {
          const key = keyOf(row, index);
          const label = primaryKey ? `row ${shortId(key)}` : `row ${String(index + 1)}`;
          return (
            <GridRow key={key} selected={selected.has(key)}>
              {primaryKey ? (
                <Cell width="3rem" padded={false}>
                  <span className="flex justify-center">
                    <Checkbox
                      checked={selected.has(key)}
                      label={`Select ${label}`}
                      onChange={(checked) => {
                        const next = new Set(selected);
                        if (checked) {
                          next.add(key);
                        } else {
                          next.delete(key);
                        }
                        onSelect(next);
                      }}
                    />
                  </span>
                </Cell>
              ) : null}
              {columns.map((column) => (
                <Cell
                  key={column.name}
                  padded={false}
                  {...(column.primaryKey || column.owner
                    ? { width: "var(--size-col-id)" }
                    : {})}
                >
                  <EditableCell
                    column={column}
                    value={row[column.name]}
                    rowLabel={label}
                    onCommit={(value) => onEdit(row, column, value)}
                  />
                </Cell>
              ))}
            </GridRow>
          );
        })}
      </DataGrid>

      <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-[var(--space-md)]">
        <p className="text-[length:var(--text-sm)] tabular-nums text-[var(--color-text-muted)]">
          Rows {offset + 1}&ndash;{offset + rows.length}
          {total === null ? "" : ` of ${String(total)}`} visible to this caller
        </p>
        <div className="ms-auto flex gap-2">
          <Button
            variant="secondary"
            disabled={offset === 0}
            onClick={() => onPage(Math.max(offset - limit, 0))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={rows.length < limit || (total !== null && offset + limit >= total)}
            onClick={() => onPage(offset + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}

/** Each mark carries its own words, so a header is not read as three symbols. */
function ColumnMarks({ column }: { column: SchemaColumn }) {
  return (
    <>
      {column.primaryKey ? <StatusPill>pk</StatusPill> : null}
      {column.owner ? <StatusPill tone="accent">owner</StatusPill> : null}
      {column.references ? (
        <StatusPill>
          fk
          <span className="sr-only">
            {" "}
            references {column.references.table}.{column.references.column}
          </span>
        </StatusPill>
      ) : null}
      {!column.primaryKey && !column.owner && column.nullable ? <StatusPill>null</StatusPill> : null}
    </>
  );
}
