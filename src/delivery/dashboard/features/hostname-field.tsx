import { Field, Input } from "../primitives/input.tsx";

/**
 * A hostname has to sit under the zone or Let's Encrypt will not issue for it.
 * Once the zone is known, only the label to the left of it is still a question,
 * so that is all this asks for. Leaving it blank means the zone itself.
 */
export function HostnameField({
  zone,
  hostname,
  onChange,
}: {
  zone: string;
  hostname: string;
  onChange: (hostname: string) => void;
}) {
  if (!zone) {
    return (
      <Field
        label="Hostname"
        hint="Pick a DNS zone first, then this is just the name in front of it."
      >
        <Input
          value={hostname}
          onChange={(event) => onChange(event.target.value)}
          placeholder="api.example.com"
          className="font-mono"
        />
      </Field>
    );
  }

  const suffix = `.${zone}`;
  const label = hostname === zone ? "" : hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : hostname;

  return (
    <Field
      label="Hostname"
      hint="Caddy asks Let's Encrypt for exactly this name. Leave the front blank to use the zone itself."
    >
      <div className="flex items-center gap-2">
        <Input
          value={label}
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange(next ? `${next}.${zone}` : zone);
          }}
          placeholder="api"
          className="max-w-40 font-mono"
        />
        <span className="font-mono text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {suffix}
        </span>
      </div>
    </Field>
  );
}
