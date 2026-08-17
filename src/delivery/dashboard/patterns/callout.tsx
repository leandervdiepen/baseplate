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
        "flex items-center gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3.5 py-2.5",
        className,
      )}
    >
      <span className="shrink-0 text-[var(--color-accent)]">{icon}</span>
      <div className="min-w-0 text-[length:var(--text-sm)] leading-[var(--leading-chip)]">{children}</div>
      {action ? <div className="ms-auto shrink-0">{action}</div> : null}
    </div>
  );
}
