import { useState } from "react";
import { changeSchema, type TableAccess } from "../lib/api/index.ts";
import { AccessChoice } from "./access-choice.tsx";
import { PolicyCard } from "./policy-card.tsx";
import { Callout } from "../patterns/callout.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card } from "../primitives/card.tsx";
import { IconLock } from "../primitives/icon.tsx";

/**
 * Who may read this table, and what that is in the database. The mode is
 * changed here; there is no off switch, because a table in `public` with no
 * declared policy is locked down rather than left open.
 */
export function RlsPanel({
  table,
  ownerColumn,
  access,
  callerSub,
  onChanged,
}: {
  table: string;
  ownerColumn: string;
  access: TableAccess;
  callerSub: string | null;
  onChanged: (statement: string) => void;
}) {
  const [choice, setChoice] = useState<TableAccess>(access);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = choice !== access;

  async function apply(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await changeSchema({ kind: "set-access", table, access: choice });
      onChanged(result.statement);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The database refused that change.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-[var(--space-md)]">
      <Card className="space-y-[var(--space-md)] p-5">
        <AccessChoice value={choice} onChange={setChoice} disabled={busy} />
        {pending ? (
          <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
            <Button busy={busy} onClick={() => void apply()}>
              Apply to the database
            </Button>
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              Takes effect at once, for every caller.
            </span>
          </div>
        ) : null}
        <StatusMessage message={error} tone="error" />
      </Card>
      <PolicyCard
        table={table}
        ownerColumn={ownerColumn}
        access={choice}
        {...(pending ? { pending } : {})}
      />
      {callerSub ? (
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
          You are browsing as <code>{callerSub}</code>, so this page shows what that caller can
          see.
        </p>
      ) : null}
      <Callout icon={<IconLock width={16} height={16} />}>
        Applied by the stack on every start, from <span className="font-mono">baseplate.tables</span>.
        A table in <span className="font-mono">public</span> that Baseplate does not know about has
        row security on, every grant revoked, and is reachable by nobody.
      </Callout>
    </div>
  );
}
