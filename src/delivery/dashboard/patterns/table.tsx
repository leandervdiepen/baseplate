import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/** A column with no width shares whatever the fixed columns leave over. */
export type Column = { key: string; label: string; width?: string };

/**
 * One raised box that clips its own corners, with a real `<table>` inside so a
 * screen reader pairs each value with its column. Wide content scrolls in the
 * box rather than widening the page.
 */
export function TableFrame({
  caption,
  fixed = false,
  head,
  children,
}: {
  caption: string;
  /** Columns share the width evenly instead of sizing to their content. */
  fixed?: boolean;
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    /* `relative` so the scroller is the containing block for the sr-only spans
       in the cells. Without it they are positioned against the page, and a
       table wider than the viewport made the whole page scroll sideways. */
    <div className="relative overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)]">
      <table className={cn("w-full border-collapse", fixed && "table-fixed")}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function HeadCell({
  children,
  width,
  sorted,
  className,
}: {
  children: ReactNode;
  width?: string;
  /** Belongs on the header cell, not on the control inside it. */
  sorted?: "ascending" | "descending" | "none";
  className?: string;
}) {
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      aria-sort={sorted}
      className={cn("px-[var(--space-md)] text-start", className)}
    >
      {children}
    </th>
  );
}

export function Row({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--color-border)] transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] last:border-b-0",
        selected
          ? "bg-[var(--color-accent-subtle)]"
          : "hover:bg-[color-mix(in_oklab,var(--color-bg-subtle)_60%,transparent)]",
      )}
    >
      {children}
    </tr>
  );
}

export function Cell({
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

/**
 * The plain reading table: fixed columns, quiet headings, no sorting and no
 * selection. Anything that needs those wants `DataGrid`.
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
    <TableFrame
      caption={caption}
      fixed
      head={columns.map((column) => (
        <HeadCell
          key={column.key}
          {...(column.width ? { width: column.width } : {})}
          className="h-9 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]"
        >
          {column.label}
        </HeadCell>
      ))}
    >
      {children}
    </TableFrame>
  );
}
