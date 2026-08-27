import { Callout } from "../patterns/callout.tsx";
import { IconLock } from "../primitives/icon.tsx";
import { PolicyCard } from "./policy-card.tsx";

/**
 * What is guarding this table, and who you are asking as. No switch: the stack
 * re-applies the policy on every start and locks down an undeclared table, so
 * there is no off state to offer.
 */
export function RlsPanel({
  table,
  ownerColumn,
  callerSub,
}: {
  table: string;
  ownerColumn: string;
  callerSub: string | null;
}) {
  return (
    <div className="space-y-[var(--space-md)]">
      <PolicyCard table={table} ownerColumn={ownerColumn} />
      {callerSub ? (
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
          You are browsing as <code>{callerSub}</code>, so this page shows
          rows whose <code>{ownerColumn}</code> is that.
        </p>
      ) : null}
      <Callout icon={<IconLock width={16} height={16} />}>
        Applied by the stack on every start, from <span className="font-mono">baseplate.tables</span>.
        A table cannot opt out: one in <span className="font-mono">public</span> with no declared
        policy has row security on, every grant revoked, and is reachable by nobody.
      </Callout>
    </div>
  );
}
