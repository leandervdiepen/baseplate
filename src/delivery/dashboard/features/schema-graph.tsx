import { useMemo, type ReactNode } from "react";
import { columnsOfCards, edgesBetween, layoutTables } from "../lib/schema-layout.ts";
import type { SchemaSnapshot } from "../lib/api/types.ts";
import { NodeCanvas, type NodeLink } from "../patterns/node-canvas.tsx";
import { SchemaCard } from "./schema-card.tsx";

/**
 * Tables as cards, each one column right of what it references, so every
 * foreign-key line runs left to right. The lines are decoration:
 * `SchemaRelations` under the canvas is the readable original.
 */
export function SchemaGraph({
  tables,
  highlighted,
  footerFor,
}: {
  tables: SchemaSnapshot["tables"];
  highlighted: string | null;
  footerFor?: (table: string) => ReactNode;
}) {
  const columns = useMemo(() => columnsOfCards(layoutTables(tables)), [tables]);
  const links = useMemo<NodeLink[]>(
    () =>
      edgesBetween(tables).map((edge) => ({
        from: `${edge.from}.${edge.fromColumn}`,
        to: `${edge.to}.${edge.toColumn}`,
      })),
    [tables],
  );

  return (
    <NodeCanvas
      columns={columns}
      links={links}
      highlighted={highlighted}
      renderNode={(name) => {
        const table = tables.find((entry) => entry.name === name);
        return table ? (
          <SchemaCard
            name={table.name}
            access={table.access}
            columns={table.columns}
            {...(footerFor ? { footer: footerFor(table.name) } : {})}
          />
        ) : null;
      }}
    />
  );
}
