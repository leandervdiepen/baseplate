import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/** A column with no width shares whatever the fixed columns leave over. */
export type Column = { key: string; label: string; width?: string };

/**
 * A real table, so a screen reader can pair every cell with its column header.
 * Wide content scrolls inside the box rather than widening the page.
 */
export function DataTable({
  columns,
  caption,
  children,
}: {
  columns: Column[];
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)]">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className="h-9 px-[var(--space-md)] text-start text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-[var(--color-border)] last:border-b-0">{children}</tr>;
}

export function DataCell({
  children,
  width,
  muted,
  mono,
}: {
  children: ReactNode;
  width?: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      style={width ? { width } : undefined}
      className={cn(
        "h-10 truncate px-[var(--space-md)] text-[length:var(--text-sm)] leading-[var(--leading-chip)]",
        muted && "text-[var(--color-text-muted)]",
        mono && "font-mono tabular-nums",
      )}
    >
      {children}
    </td>
  );
}
