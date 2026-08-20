import { useEffect, useState } from "react";
import { getHistory, type SchemaHistoryEntry, type SchemaSnapshot } from "../lib/operator-client.ts";
import { SchemaGraph } from "../patterns/schema-graph.tsx";
import { SchemaRelations } from "../patterns/schema-card.tsx";
import { SchemaHistory } from "./schema-history.tsx";
import { TableActions } from "./table-actions.tsx";

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
  const [history, setHistory] = useState<SchemaHistoryEntry[]>([]);

  useEffect(() => {
    void getHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [tables]);

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
