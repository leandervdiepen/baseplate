import { Section } from "../patterns/section.tsx";
import { Field, Input } from "../primitives/input.tsx";
import { TogglePills } from "../primitives/toggle-pills.tsx";

const PRESETS = ["15m", "1h", "12h", "7d", "30d"].map((id) => ({ id, label: id }));

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
    <Section
      title="Sessions"
      description="A short access token limits what a leaked one is worth. The client refreshes before it expires, so nobody is signed out. Refresh tokens are single use and can be revoked; access tokens cannot, which is why they should be short."
    >
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
    </Section>
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
            {hint} Sets <code>{env}</code>.
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
      <TogglePills
        mono
        label={`${label} presets`}
        options={PRESETS}
        value={value.trim()}
        onChange={onChange}
      />
    </div>
  );
}
