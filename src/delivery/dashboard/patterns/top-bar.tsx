import { loadCaller } from "../lib/caller.ts";
import { peekJwt } from "../lib/jwt.ts";
import { shortId } from "../lib/format.ts";
import { CRUMBS, type NavId } from "./nav.ts";

export function TopBar({ current }: { current: NavId }) {
  const crumb = CRUMBS[current];
  const caller = loadCaller();
  const peek = caller ? peekJwt(caller.token) : {};
  const sub = caller?.sub ?? peek.sub;
  const role = caller?.role ?? peek.role;

  return (
    <header className="flex h-[var(--size-topbar)] shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-xl)]">
      <div className="flex items-center gap-[var(--space-sm)]">
        <span className="text-[length:var(--text-sm)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
          {crumb.section}
        </span>
        <span className="text-[length:var(--text-sm)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
          /
        </span>
        <span className="font-mono text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)]">
          {crumb.leaf}
        </span>
      </div>
      {sub ? (
        <div className="flex h-[30px] items-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3">
          <span className="size-[var(--size-dot-sm)] shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-accent)]" />
          <span className="text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
            caller
          </span>
          <span className="font-mono text-[length:var(--text-xs)] leading-[var(--leading-chip)] tabular-nums">
            sub {shortId(sub)}
          </span>
          {role ? (
            <>
              <span className="h-3 w-px shrink-0 bg-[var(--color-border)]" />
              <span className="font-mono text-[length:var(--text-xs)] leading-[var(--leading-chip)]">
                role {role}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex h-[30px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          no caller yet
        </div>
      )}
    </header>
  );
}
