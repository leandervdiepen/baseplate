import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export function Callout({
  icon,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] py-1.5 ps-3.5 pe-1.5",
        className,
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-[var(--color-accent)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1 py-1 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
