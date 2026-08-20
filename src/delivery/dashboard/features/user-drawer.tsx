import { useState, type ReactNode } from "react";
import {
  deleteUser,
  mintToken,
  recoveryLink,
  revokeUserSessions,
  type OperatorUser,
} from "../lib/api/index.ts";
import { saveCaller } from "../lib/caller.ts";
import { peekJwt } from "../lib/jwt.ts";
import { ConfirmInline } from "../patterns/confirm-inline.tsx";
import { Drawer } from "../patterns/drawer.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { StatusPill } from "../primitives/chip.tsx";
import { CopyButton } from "../primitives/copy-button.tsx";
import { Hint } from "../primitives/input.tsx";

type Action = "impersonate" | "reset" | "revoke" | "delete";

/**
 * One user, and the four things worth doing to them. Impersonating is the one
 * that matters most: it puts their token in this browser session, so Tables
 * answers as them and shows exactly the rows they can see.
 */
export function UserDrawer({
  user,
  onClose,
  onDeleted,
}: {
  user: OperatorUser;
  onClose: () => void;
  onDeleted: (email: string) => void;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  /** Every action here reports the same way: one thing said, or one thing wrong. */
  function act(kind: Action, run: () => Promise<string>): void {
    setBusy(kind);
    setError(null);
    setSaid(null);
    void run()
      .then(setSaid)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "That did not work.");
      })
      .finally(() => setBusy(null));
  }

  const impersonate = (): void =>
    act("impersonate", async () => {
      const issued = await mintToken(user.id);
      saveCaller({ sub: issued.sub, token: issued.token, role: peekJwt(issued.token).role });
      return `Tables now shows what ${user.email} sees.`;
    });

  const reset = (): void =>
    act("reset", async () => {
      const recovery = await recoveryLink(user.id);
      setLink(recovery.link);
      return `A reset link for ${user.email} is ready below.`;
    });

  const revoke = (): void =>
    act("revoke", async () => {
      const { revoked } = await revokeUserSessions(user.id);
      return `Ended ${String(revoked)} session${revoked === 1 ? "" : "s"} for ${user.email}.`;
    });

  const remove = (): void => {
    setBusy("delete");
    setError(null);
    void deleteUser(user.id)
      .then(() => onDeleted(user.email))
      .catch((cause: unknown) => {
        setConfirming(false);
        setBusy(null);
        setError(cause instanceof Error ? cause.message : `${user.email} was not deleted.`);
      });
  };

  return (
    <Drawer
      title={user.email}
      description="What this account is, and what you can do to it."
      onClose={onClose}
    >
      <dl className="mb-[var(--space-lg)] flex flex-col">
        <Fact label="User id">
          <span className="flex flex-wrap items-center gap-1.5">
            <code className="min-w-0 break-all font-mono text-[length:var(--text-xs)] tabular-nums">
              {user.id}
            </code>
            <CopyButton className="px-2" value={user.id} label="Copy id" />
          </span>
        </Fact>
        <Fact label="Created">{new Date(user.createdAt).toLocaleString()}</Fact>
        <Fact label="Last sign-in">
          {user.lastSignInAt ? (
            new Date(user.lastSignInAt).toLocaleString()
          ) : (
            <span className="text-[var(--color-text-muted)]">never</span>
          )}
        </Fact>
        <Fact label="Email">
          {user.emailConfirmedAt ? (
            <StatusPill tone="accent">confirmed</StatusPill>
          ) : (
            <StatusPill>pending</StatusPill>
          )}
        </Fact>
      </dl>

      <div className="flex flex-wrap gap-[var(--space-sm)]">
        <Button busy={busy === "impersonate"} onClick={impersonate}>
          Impersonate
        </Button>
        <Button variant="secondary" busy={busy === "reset"} onClick={reset}>
          Reset password
        </Button>
        <Button variant="secondary" busy={busy === "revoke"} onClick={revoke}>
          Revoke sessions
        </Button>
      </div>
      <div className="mt-[var(--space-sm)]">
        <Hint>
          Impersonating puts their token in this browser session, so Tables answers as them.
          Revoking ends every session they have open, password unchanged.
        </Hint>
      </div>

      <StatusMessage message={said} className="mt-[var(--space-md)] block" />
      <StatusMessage message={error} tone="error" className="mt-[var(--space-md)] block" />

      {link ? (
        <div className="reveal mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
          <p className="break-all rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
            {link}
          </p>
          <CopyButton className="self-start" value={link} label="Copy reset link" />
          <Hint>Also emailed; the local inbox shows it.</Hint>
        </div>
      ) : null}

      <div className="mt-[var(--space-lg)] border-t border-[var(--color-border)] pt-[var(--space-md)]">
        {confirming ? (
          <ConfirmInline
            confirmLabel="Delete the user"
            busy={busy === "delete"}
            onConfirm={remove}
            onCancel={() => setConfirming(false)}
          >
            Delete <code>{user.email}</code> and their sessions? Their rows stay.
          </ConfirmInline>
        ) : (
          <Button
            variant="quiet-danger"
            className="px-3"
            onClick={() => setConfirming(true)}
          >
            Delete user<span className="sr-only"> {user.email}</span>
          </Button>
        )}
      </div>
    </Drawer>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[var(--space-md)] gap-y-1 border-b border-[var(--color-border)] py-2.5 last:border-b-0">
      <dt className="w-[7.5rem] shrink-0 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">
        {children}
      </dd>
    </div>
  );
}
