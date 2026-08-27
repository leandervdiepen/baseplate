import { useCaller } from "../lib/caller.ts";
import { peekJwt } from "../lib/jwt.ts";
import { shortId } from "../lib/format.ts";
import { StatusDot } from "../primitives/status-dot.tsx";

/**
 * Who the studio is acting as, on every page: rows are filtered by the caller,
 * so "why am I seeing this" has to be answerable without leaving the page that
 * raised it. Read from the session, or from the token's claims when a minted
 * token is all there is.
 */
export function CallerPill() {
  const caller = useCaller();
  const peek = caller ? peekJwt(caller.token) : {};
  const sub = caller?.sub ?? peek.sub;
  const role = caller?.role ?? peek.role;

  if (!sub) {
    return (
      <div className="flex h-[30px] shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        No caller yet
      </div>
    );
  }

  return (
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
  );
}
