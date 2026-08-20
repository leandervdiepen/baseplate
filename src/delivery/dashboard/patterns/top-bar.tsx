import { useCaller } from "../lib/caller.ts";
import { peekJwt } from "../lib/jwt.ts";
import { shortId } from "../lib/format.ts";
import { StatusDot } from "../primitives/status-dot.tsx";
import { CRUMBS, type NavId } from "./nav.ts";

export function TopBar({ current, leaf }: { current: NavId; leaf?: string | null | undefined }) {
  const crumb = CRUMBS[current];
  const caller = useCaller();
  const peek = caller ? peekJwt(caller.token) : {};
  const sub = caller?.sub ?? peek.sub;
  const role = caller?.role ?? peek.role;

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
      {sub ? (
        <div className="flex h-[30px] shrink-0 items-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3">
          <StatusDot ok small />
          <span className="text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
            caller
          </span>
          <span className="font-mono text-[length:var(--text-xs)] leading-[var(--leading-chip)] tabular-nums">
            sub {shortId(sub)}
          </span>
          {role ? (
            <>
              <span aria-hidden="true" className="h-3 w-px shrink-0 bg-[var(--color-border)]" />
              <span className="hidden font-mono text-[length:var(--text-xs)] leading-[var(--leading-chip)] sm:inline">
                role {role}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex h-[30px] shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          No caller yet
        </div>
      )}
    </header>
  );
}
