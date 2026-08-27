import type { CallerSession } from "../lib/caller.ts";
import type { SchemaTable } from "../lib/api/types.ts";
import { TableGrid } from "./table-grid.tsx";
import { TableToolbar } from "./table-toolbar.tsx";
import type { Panel } from "./table-panels.tsx";
import type { useTableRows } from "./use-table-rows.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { Button } from "../primitives/button.tsx";

/** Rows need a caller before they need anything else: they are filtered by who asks. */
export function TableRows({
  caller,
  table,
  data,
  primaryKey,
  onNeedToken,
  onPanel,
}: {
  caller: CallerSession | undefined;
  table: SchemaTable | undefined;
  data: ReturnType<typeof useTableRows>;
  primaryKey: string | null;
  onNeedToken: () => void;
  onPanel: (panel: Panel) => void;
}) {
  if (!caller) {
    return (
      <EmptyState
        title="No caller yet"
        description="Rows are filtered by who is asking, so the studio needs a token before it can show you any."
        action={<Button onClick={onNeedToken}>Issue a token</Button>}
      />
    );
  }
  if (!table) {
    return null;
  }
  return (
    <>
      <TableToolbar
        table={table.name}
        ownerColumn={table.ownerColumn}
        access={table.access}
        columns={table.columns}
        filters={data.filters}
        onFilters={data.filterBy}
        selectedCount={data.chosen.size}
        onDelete={data.removeChosen}
        onRefresh={data.refresh}
        onInsert={() => onPanel("insert")}
        onRls={() => onPanel("rls")}
        onApi={() => onPanel("api")}
        onEditTable={() => onPanel("edit-table")}
        busy={data.busy}
      />
      <TableGrid
        table={table.name}
        access={table.access}
        columns={table.columns}
        rows={data.rows}
        primaryKey={primaryKey}
        sort={data.sort}
        onSort={data.sortBy}
        selected={data.chosen}
        onSelect={data.setChosen}
        onEdit={data.edit}
        total={data.total}
        offset={data.offset}
        limit={data.limit}
        onPage={data.setOffset}
        filtered={data.filters.length > 0}
      />
    </>
  );
}
