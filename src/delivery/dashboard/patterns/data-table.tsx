import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export function DataTable({
  columns,
  children,
}: {
  columns: { key: string; label: string; width?: string; grow?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex h-9 items-center gap-[var(--space-lg)] border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)]">
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              "shrink-0 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]",
              column.grow && "min-w-0 grow basis-0",
            )}
            style={column.width ? { width: column.width } : undefined}
          >
            {column.label}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export function DataRow({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[41px] items-center gap-[var(--space-lg)] px-[var(--space-md)]",
        !last && "border-b border-[var(--color-border)]",
      )}
    >
      {children}
    </div>
  );
}

export function DataCell({
  children,
  width,
  grow,
  muted,
  mono,
}: {
  children: ReactNode;
  width?: string;
  grow?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 text-[length:var(--text-sm)] leading-[var(--leading-chip)]",
        grow && "min-w-0 grow basis-0 truncate",
        muted && "text-[var(--color-text-muted)]",
        mono && "font-mono tabular-nums",
      )}
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  );
}
