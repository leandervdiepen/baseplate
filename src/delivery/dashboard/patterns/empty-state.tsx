import type { ReactNode } from "react";
import { IconTables } from "../primitives/icon.tsx";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-enter flex min-h-[28rem] flex-col items-center justify-center pb-[var(--space-xl)]">
      <div className="mb-5 flex size-12 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <IconTables width={20} height={20} className="text-[var(--color-accent)]" />
      </div>
      <h2 className="mb-[var(--space-sm)] text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]">
        {title}
      </h2>
      <p className="mb-[var(--space-lg)] max-w-[340px] text-center text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
        {description}
      </p>
      {action}
    </div>
  );
}
