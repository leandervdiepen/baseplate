import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export type Tone = "plain" | "good" | "warn" | "bad";

/**
 * One fact, at the size it deserves. The label says what it is, the value is
 * the answer, and the line under it is the detail somebody would otherwise have
 * to go and look up.
 */
export function Stat({
  label,
  value,
  detail,
  tone = "plain",
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: Tone;
}) {
  return (
    <>
      <p className="text-[length:var(--text-2xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tabular-nums",
          tone === "good" && "text-[var(--color-accent-strong)]",
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
    </>
  );
}

/** The same fact, on its own surface, with an icon and somewhere to go next. */
export function StatCard({
  icon,
  action,
  ...stat
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: Tone;
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
        <Stat {...stat} />
        {action ? <div className="mt-[var(--space-sm)]">{action}</div> : null}
      </div>
    </div>
  );
}
