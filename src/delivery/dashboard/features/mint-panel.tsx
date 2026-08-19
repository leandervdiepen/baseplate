import { useState } from "react";
import { saveCaller, useCaller, useIssued } from "../lib/caller.ts";
import { shortId } from "../lib/format.ts";
import { peekJwt } from "../lib/jwt.ts";
import { mintToken } from "../lib/operator-client.ts";
import { DataCell, DataRow, DataTable } from "../patterns/data-table.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card, CardTitle } from "../primitives/card.tsx";
import { MonoChip, StatusPill } from "../primitives/chip.tsx";
import { CopyButton } from "../primitives/copy-button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

const SAMPLE = "11111111-1111-4111-8111-111111111111";

export function MintPanel() {
  const caller = useCaller();
  const recents = useIssued();
  const [sub, setSub] = useState(caller?.sub ?? SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const token = caller?.token ?? "";
  const peek = token ? peekJwt(token) : {};
  const role = peek.role ?? caller?.role ?? "app_user";

  async function issue(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await mintToken(sub);
      saveCaller({ sub: result.sub, token: result.token, role: peekJwt(result.token).role });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to issue a token for that subject.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-lg)]">
      <div className="grid items-start gap-[var(--space-lg)] lg:grid-cols-2">
        <Card className="p-5">
          <form
            className="flex flex-col gap-[var(--space-md)]"
            onSubmit={(event) => {
              event.preventDefault();
              void issue();
            }}
          >
            <CardTitle>Impersonate a caller</CardTitle>
            <Field
              label="Subject"
              hint="The user id the token speaks for. For tests and scripts; apps sign up with an email."
            >
              <Input
                value={sub}
                onChange={(event) => setSub(event.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <StatusMessage message={error} tone="error" />
            <Button type="submit" className="self-start" busy={busy}>
              Mint token
            </Button>
            <Hint>
              The same from a terminal:{" "}
              <code className="font-mono">baseplate mint-token --sub UUID</code>
            </Hint>
          </form>
        </Card>

        <Card className="flex flex-col gap-3.5 p-5">
          <CardTitle>Latest token</CardTitle>
          {token ? (
            <>
              <p className="break-all rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
                {token}
              </p>
              <div className="flex flex-wrap gap-[var(--space-sm)]">
                <MonoChip>sub {shortId(peek.sub ?? sub)}</MonoChip>
                <MonoChip>role {role}</MonoChip>
              </div>
              <CopyButton value={token} label="Copy token" />
            </>
          ) : (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              Sign up or mint a token and the JWT appears here.
            </p>
          )}
        </Card>
      </div>

      {recents.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[length:var(--text-sm)] font-medium">Issued this session</h2>
          <DataTable
            caption="Tokens issued in this browser session"
            columns={[
              { key: "token", label: "token" },
              { key: "sub", label: "subject", width: "var(--size-col-id)" },
              { key: "role", label: "role", width: "120px" },
              { key: "status", label: "status", width: "96px" },
            ]}
          >
            {recents.map((item, index) => (
              <DataRow key={item.token}>
                <DataCell mono>{shortId(item.token)}</DataCell>
                <DataCell width="var(--size-col-id)" mono muted>
                  {shortId(item.sub)}
                </DataCell>
                <DataCell width="120px" mono>
                  {item.role ?? peekJwt(item.token).role ?? "app_user"}
                </DataCell>
                <DataCell width="96px">
                  <StatusPill tone={index === 0 ? "accent" : "muted"}>
                    {index === 0 ? "in use" : "replaced"}
                  </StatusPill>
                </DataCell>
              </DataRow>
            ))}
          </DataTable>
        </section>
      ) : null}
    </div>
  );
}
