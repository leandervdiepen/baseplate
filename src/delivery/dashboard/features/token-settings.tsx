import { useState } from "react";
import { saveConfig, type OperatorStatus } from "../lib/operator-client.ts";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

const PRESETS = ["15m", "1h", "12h", "7d", "30d"];

export function TokenSettings({
  status,
  onChanged,
}: {
  status: OperatorStatus;
  onChanged: () => void;
}) {
  const [access, setAccess] = useState(status.accessTokenTtl);
  const [refresh, setRefresh] = useState(status.refreshTokenTtl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveConfig({
        ACCESS_TOKEN_TTL: access.trim(),
        REFRESH_TOKEN_TTL: refresh.trim(),
      });
      setMessage("Saved. Provision to restart auth with the new lifetimes.");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
      <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
        Sessions
      </h2>
      <Hint>
        A short access token limits what a leaked one is worth. The client refreshes before
        it expires, so users are not signed out. Refresh tokens are single use and can be
        revoked; access tokens cannot, which is why they should be short.
      </Hint>
      <div className="flex flex-wrap gap-[var(--space-md)]">
        <Field label="ACCESS_TOKEN_TTL" hint="How long an API call stays authorised.">
          <TtlInput value={access} onChange={setAccess} />
        </Field>
        <Field label="REFRESH_TOKEN_TTL" hint="How long a signed-in user stays signed in.">
          <TtlInput value={refresh} onChange={setRefresh} />
        </Field>
      </div>
      {message ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-accent-strong)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      <Button className="self-start" onClick={() => void save()} disabled={busy}>
        Save lifetimes
      </Button>
    </section>
  );
}

function TtlInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-40 font-mono"
        placeholder="1h"
      />
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-1 font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
