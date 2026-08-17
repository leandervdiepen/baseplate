import { StatusPill } from "../primitives/chip.tsx";
import { Button } from "../primitives/button.tsx";
import type { SchemaColumn, SchemaSnapshot } from "../lib/operator-client.ts";
import { cn } from "../lib/cn.ts";

export function SchemaCard({
  name,
  columns,
  onOpenRows,
}: {
  name: string;
  columns: SchemaColumn[];
  onOpenRows: () => void;
}) {
  return (
    <article className="w-[300px] shrink-0 overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
        <span className="min-w-0 grow truncate font-mono text-[length:var(--text-sm)] font-medium">
          public.{name}
        </span>
        <StatusPill tone="accent">rls</StatusPill>
      </header>
      <ul>
        {columns.map((column, index) => (
          <ColumnRow
            key={column.name}
            column={column}
            last={index === columns.length - 1}
          />
        ))}
      </ul>
      <footer className="border-t border-[var(--color-border)] px-3 py-2">
        <Button variant="ghost" className="h-10 min-h-10 px-0" onClick={onOpenRows}>
          Open rows
        </Button>
      </footer>
    </article>
  );
}

function ColumnRow({ column, last }: { column: SchemaColumn; last: boolean }) {
  const ref = column.references
    ? `${column.references.table}.${column.references.column}`
    : null;
  return (
    <li
      className={cn(
        "flex min-h-10 items-center gap-2 px-3",
        !last && "border-b border-[var(--color-border)]",
      )}
    >
      <span className="min-w-0 grow truncate font-mono text-[length:var(--text-sm)] tabular-nums">
        {column.name}
      </span>
      <span className="w-14 shrink-0 font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        {column.type}
      </span>
      <span className="flex w-16 shrink-0 justify-end gap-1">
        {column.primaryKey ? <StatusPill>pk</StatusPill> : null}
        {ref ? <StatusPill>fk</StatusPill> : null}
        {column.owner ? <StatusPill tone="accent">owner</StatusPill> : null}
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
    <ul className="mt-[var(--space-lg)] space-y-1 font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
      {links.map((link) => (
        <li key={`${link.from}->${link.to}`}>
          {link.from} → {link.to}
        </li>
      ))}
    </ul>
  );
}
