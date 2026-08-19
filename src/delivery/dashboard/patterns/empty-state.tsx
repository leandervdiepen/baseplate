import type { ReactNode } from "react";
import { IconTables } from "../primitives/icon.tsx";

/**
 * An empty state says what this place is for and offers the one action that
 * fills it. "Nothing here" on its own is a shrug.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-enter flex min-h-[24rem] flex-col items-center justify-center pb-[var(--space-xl)]">
      <div className="mb-5 flex size-12 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-accent)]">
        {icon ?? <IconTables width={20} height={20} />}
      </div>
      <h2 className="mb-[var(--space-sm)] text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]">
        {title}
      </h2>
      <p className="mb-[var(--space-lg)] max-w-[380px] text-center text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
        {description}
      </p>
      {action}
    </div>
  );
}
