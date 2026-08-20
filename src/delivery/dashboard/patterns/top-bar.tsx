import type { ReactNode } from "react";
import { CRUMBS, type NavId } from "./nav.ts";

export function TopBar({
  current,
  leaf,
  callerControl,
}: {
  current: NavId;
  leaf?: string | null | undefined;
  /** Who the studio is acting as. Passed in: a pattern does not know callers. */
  callerControl?: ReactNode;
}) {
  const crumb = CRUMBS[current];

  return (
    <header className="flex h-[var(--size-topbar)] shrink-0 items-center justify-between gap-[var(--space-md)] border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-md)] lg:px-[var(--space-xl)]">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-[var(--space-sm)]">
        <span className="text-[length:var(--text-sm)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
          {crumb.section}
        </span>
        <span aria-hidden="true" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          /
        </span>
        <span className="truncate font-mono text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)]">
          {leaf ?? crumb.leaf}
        </span>
      </nav>
      {callerControl}
    </header>
  );
}
