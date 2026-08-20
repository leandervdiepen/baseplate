import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/**
 * One fact, at the size it deserves. The label says what it is, the value is
 * the answer, and the line under it is the detail somebody would otherwise have
 * to go and look up.
 */
export function StatCard({
  icon,
  label,
  value,
  detail,
  tone = "plain",
  action,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: "plain" | "good" | "warn" | "bad";
  action?: ReactNode;
}) {
  return (
    <div className="flex gap-[var(--space-md)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-md)] shadow-[var(--shadow-raised)]">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"
      >
        {icon}
      </span>
      <div className="min-w-0 grow">
        <p className="text-[length:var(--text-2xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 truncate text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tabular-nums",
            tone === "good" && "text-[var(--color-accent-strong)]",
            tone === "warn" && "text-[var(--color-text)]",
            tone === "bad" && "text-[var(--color-danger)]",
          )}
        >
          {value}
        </p>
        {detail ? (
          <p className="mt-0.5 text-[length:var(--text-xs)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
            {detail}
          </p>
        ) : null}
        {action ? <div className="mt-[var(--space-sm)]">{action}</div> : null}
      </div>
    </div>
  );
}
