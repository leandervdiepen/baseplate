import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Card } from "../primitives/card.tsx";
import { StatusPill } from "../primitives/chip.tsx";
import type { SchemaColumn, SchemaSnapshot } from "../lib/operator-client.ts";

/**
 * One card, one border. The actions live in this card's footer rather than in a
 * second bordered box wrapped around it.
 */
export function SchemaCard({
  name,
  columns,
  footer,
}: {
  name: string;
  columns: SchemaColumn[];
  footer?: ReactNode;
}) {
  return (
    <Card className="w-[360px] max-w-full shrink-0 overflow-clip">
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <h2 className="min-w-0 grow truncate font-mono text-[length:var(--text-sm)] font-medium">
          public.{name}
        </h2>
        <StatusPill tone="accent">rls</StatusPill>
      </header>
      <ul>
        {columns.map((column, index) => (
          <ColumnRow
            key={column.name}
            table={name}
            column={column}
            last={index === columns.length - 1}
          />
        ))}
      </ul>
      {footer ? <div className="border-t border-[var(--color-border)]">{footer}</div> : null}
    </Card>
  );
}

function ColumnRow({
  table,
  column,
  last,
}: {
  table: string;
  column: SchemaColumn;
  last: boolean;
}) {
  return (
    <li
      // Where a foreign key line starts or lands, measured by SchemaGraph.
      data-anchor={`${table}.${column.name}`}
      className={cn(
        "flex min-h-10 items-center gap-2 px-3",
        !last && "border-b border-[var(--color-border)]",
      )}
    >
      <span className="min-w-0 grow truncate font-mono text-[length:var(--text-sm)]">
        {column.name}
      </span>
      <span className="w-16 shrink-0 font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        {column.type}
      </span>
      <span className="flex w-16 shrink-0 justify-end gap-1">
        {column.primaryKey ? <StatusPill>pk</StatusPill> : null}
        {column.references ? <StatusPill>fk</StatusPill> : null}
        {column.owner ? <StatusPill tone="accent">owner</StatusPill> : null}
        {!column.primaryKey && !column.owner && column.nullable ? (
          <StatusPill>null</StatusPill>
        ) : null}
      </span>
    </li>
  );
}

export function SchemaRelations({ tables }: { tables: SchemaSnapshot["tables"] }) {
  const links = tables.flatMap((table) =>
    table.columns
      .filter((column) => column.references)
      .map((column) => ({
        from: `${table.name}.${column.name}`,
        to: `${column.references?.table}.${column.references?.column}`,
      })),
  );
  if (links.length === 0) {
    return null;
  }
  return (
    <section className="mt-[var(--space-lg)]">
      <h2 className="mb-2 text-[length:var(--text-sm)] font-medium">References</h2>
      <ul className="space-y-1 font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        {links.map((link) => (
          <li key={`${link.from}->${link.to}`}>
            {link.from} → {link.to}
          </li>
        ))}
      </ul>
    </section>
  );
}
