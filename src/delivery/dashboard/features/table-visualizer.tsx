import type { SchemaSnapshot } from "../lib/api/index.ts";
import { SchemaGraph } from "./schema-graph.tsx";
import { SchemaRelations } from "./schema-card.tsx";
import { SchemaHistory } from "./schema-history.tsx";
import { TableActions } from "./table-actions.tsx";
import { useSchemaHistory } from "./use-schema-history.ts";

/**
 * The shape of the schema rather than what is in it: every table, its columns,
 * and a line from each foreign key to what it points at.
 */
export function TableVisualizer({
  tables,
  selected,
  onOpenRows,
  onChanged,
}: {
  tables: SchemaSnapshot["tables"];
  selected: string | null;
  onOpenRows: (table: string) => void;
  onChanged: (statement: string) => void;
}) {
  const history = useSchemaHistory(tables);

  return (
    <>
      <SchemaGraph
        tables={tables}
        highlighted={selected}
        footerFor={(table) => (
          <TableActions table={table} onOpenRows={() => onOpenRows(table)} onChanged={onChanged} />
        )}
      />
      <SchemaRelations tables={tables} />
      <SchemaHistory entries={history} />
    </>
  );
}
