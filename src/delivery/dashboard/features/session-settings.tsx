import { cn } from "../lib/cn.ts";
import { Field, Input } from "../primitives/input.tsx";

const PRESETS = ["15m", "1h", "12h", "7d", "30d"];

/**
 * Controlled on purpose. The page saves every setting in one action, so this
 * section holds no state and no save button of its own.
 */
export function SessionSettings({
  access,
  refresh,
  onAccess,
  onRefresh,
}: {
  access: string;
  refresh: string;
  onAccess: (value: string) => void;
  onRefresh: (value: string) => void;
}) {
  return (
    <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
      <div>
        <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
          Sessions
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
          A short access token limits what a leaked one is worth. The client refreshes before it
          expires, so nobody is signed out. Refresh tokens are single use and can be revoked;
          access tokens cannot, which is why they should be short.
        </p>
      </div>
      <div className="flex flex-wrap gap-[var(--space-lg)]">
        <TtlField
          label="Access token lifetime"
          hint="How long one API call stays authorised."
          env="ACCESS_TOKEN_TTL"
          value={access}
          onChange={onAccess}
        />
        <TtlField
          label="Sign-in lifetime"
          hint="How long someone stays signed in without logging in again."
          env="REFRESH_TOKEN_TTL"
          value={refresh}
          onChange={onRefresh}
        />
      </div>
    </section>
  );
}

function TtlField({
  label,
  hint,
  env,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  env: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex min-w-56 flex-col gap-[var(--space-sm)]">
      <Field
        label={label}
        hint={
          <>
            {hint} Sets <code className="font-mono">{env}</code>.
          </>
        }
      >
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="max-w-40 font-mono"
          placeholder="1h"
        />
      </Field>
      <div role="group" aria-label={`${label} presets`} className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const selected = value.trim() === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset)}
              className={cn(
                "min-h-10 rounded-[var(--radius-md)] border px-3 font-mono text-[length:var(--text-xs)] transition-[background-color,color,border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                selected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-strong)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {preset}
            </button>
          );
        })}
      </div>
    </div>
  );
}
