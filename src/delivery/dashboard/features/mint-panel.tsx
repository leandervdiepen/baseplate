import { useState } from "react";
import { clearCaller, saveCaller, useCaller, useIssued } from "../lib/caller.ts";
import { shortId } from "../lib/format.ts";
import { peekJwt } from "../lib/jwt.ts";
import { mintToken } from "../lib/api/index.ts";
import { Cell, DataTable, Row } from "../patterns/table.tsx";
import { Section } from "../patterns/section.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card } from "../primitives/card.tsx";
import { Title } from "../primitives/heading.tsx";
import { MonoChip, StatusPill } from "../primitives/chip.tsx";
import { CopyButton } from "../primitives/copy-button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

const SAMPLE = "11111111-1111-4111-8111-111111111111";

/**
 * Minted tokens expire now, so the card says when. Read at render rather than
 * counted down: a ticking clock would redraw the page to tell you nothing.
 */
function expiryLabel(exp: number | undefined): string | null {
  if (exp === undefined) {
    return null;
  }
  const minutes = Math.ceil((exp * 1000 - Date.now()) / 60000);
  return minutes <= 0 ? "expired" : `expires in ${String(minutes)}m`;
}

export function MintPanel() {
  const caller = useCaller();
  const recents = useIssued();
  const [sub, setSub] = useState(caller?.sub ?? SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const token = caller?.token ?? "";
  const peek = token ? peekJwt(token) : {};
  const role = peek.role ?? caller?.role ?? "app_user";
  const expiry = expiryLabel(peek.exp);

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
            <Title>Impersonate a caller</Title>
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
              <code>baseplate mint-token --sub UUID</code>
            </Hint>
          </form>
        </Card>

        <Card className="flex flex-col gap-3.5 p-5">
          <Title>Latest token</Title>
          {token ? (
            <>
              <p className="break-all rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
                {token}
              </p>
              <div className="flex flex-wrap gap-[var(--space-sm)]">
                <MonoChip>sub {shortId(peek.sub ?? sub)}</MonoChip>
                <MonoChip>role {role}</MonoChip>
                {expiry ? <MonoChip>{expiry}</MonoChip> : null}
              </div>
              <div className="flex flex-wrap gap-[var(--space-sm)]">
                <CopyButton value={token} label="Copy token" />
                {/* The way to stop impersonating. Without it the tab keeps
                    answering as somebody until it is closed. */}
                <Button variant="ghost" onClick={clearCaller}>
                  Clear
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              Sign up or mint a token and the JWT appears here.
            </p>
          )}
        </Card>
      </div>

      {recents.length > 0 ? (
        <Section divided={false} title="Issued this session">
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
              <Row key={item.token}>
                <Cell mono>{shortId(item.token)}</Cell>
                <Cell width="var(--size-col-id)" mono muted>
                  {shortId(item.sub)}
                </Cell>
                <Cell width="120px" mono>
                  {item.role ?? peekJwt(item.token).role ?? "app_user"}
                </Cell>
                <Cell width="96px">
                  <StatusPill tone={index === 0 ? "accent" : "muted"}>
                    {index === 0 ? "in use" : "replaced"}
                  </StatusPill>
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Section>
      ) : null}
    </div>
  );
}
