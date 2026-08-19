import { useState } from "react";
import { loadCaller, loadIssued, saveCaller } from "../lib/caller.ts";
import { shortId } from "../lib/format.ts";
import { peekJwt } from "../lib/jwt.ts";
import { mintToken } from "../lib/operator-client.ts";
import { DataCell, DataRow, DataTable } from "../patterns/data-table.tsx";
import { Button } from "../primitives/button.tsx";
import { CapsLabel, MonoChip, StatusPill } from "../primitives/chip.tsx";
import { IconCopy } from "../primitives/icon.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

const SAMPLE = "11111111-1111-4111-8111-111111111111";

export function MintPanel({ onIssued }: { onIssued: () => void }) {
  const existing = loadCaller();
  const [sub, setSub] = useState(existing?.sub ?? SAMPLE);
  const [token, setToken] = useState(existing?.token ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recents = loadIssued();
  const peek = token ? peekJwt(token) : {};
  const role = peek.role ?? existing?.role ?? "app_user";

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const result = await mintToken(sub);
      const claims = peekJwt(result.token);
      setToken(result.token);
      saveCaller({ sub: result.sub, token: result.token, role: claims.role });
      onIssued();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to issue token.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <div className="grid gap-[var(--space-lg)] md:grid-cols-2">
      <section className="flex flex-col gap-[var(--space-md)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]">
          Impersonate a caller
        </h2>
        <Field label="Subject (user UUID)" hint="Operator mint for tests. Apps should sign up with email.">
          <Input
            value={sub}
            onChange={(event) => setSub(event.target.value)}
            className="font-mono tabular-nums"
          />
        </Field>
        {error ? (
          <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
        ) : null}
        <Button onClick={() => void issue()} disabled={busy}>
          {busy ? "Signing…" : "Mint token"}
        </Button>
        <Hint>Same from a terminal: baseplate mint-token --sub UUID</Hint>
      </section>
      <section className="flex flex-col gap-3.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <CapsLabel>Latest token</CapsLabel>
        {token ? (
          <>
            <div className="break-all rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
              {token}
            </div>
            <div className="flex gap-[var(--space-sm)]">
              <MonoChip>sub {shortId(peek.sub ?? sub)}</MonoChip>
              <MonoChip>role {role}</MonoChip>
            </div>
            <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(token)}>
              <IconCopy />
              Copy token
            </Button>
          </>
        ) : (
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            Sign up or mint a token to see the JWT here.
          </p>
        )}
      </section>
      </div>
      {recents.length > 0 ? (
        <>
          <h2 className="mb-3 text-[length:var(--text-sm)] font-medium">Recently issued</h2>
          <DataTable
            columns={[
              { key: "token", label: "token", grow: true },
              { key: "sub", label: "subject", width: "var(--size-col-id)" },
              { key: "role", label: "role", width: "120px" },
              { key: "status", label: "status", width: "88px" },
            ]}
          >
            {recents.map((item, index) => (
              <DataRow key={item.token} last={index === recents.length - 1}>
                <DataCell grow mono>
                  {shortId(item.token)}
                </DataCell>
                <DataCell width="var(--size-col-id)" mono muted>
                  {shortId(item.sub)}
                </DataCell>
                <DataCell width="120px" mono>
                  {item.role ?? peekJwt(item.token).role ?? "app_user"}
                </DataCell>
                <DataCell width="88px">
                  <StatusPill tone={index === 0 ? "accent" : "muted"}>
                    {index === 0 ? "active" : "session"}
                  </StatusPill>
                </DataCell>
              </DataRow>
            ))}
          </DataTable>
        </>
      ) : null}
    </>
  );
}
