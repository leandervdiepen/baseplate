import type { OperatorStatus } from "../lib/operator-client.ts";
import { Field, Input } from "../primitives/input.tsx";
import { SecretField } from "../primitives/secret-field.tsx";

export type HetznerDraft = {
  hostname: string;
  zone: string;
  hcloud: string;
  dnsToken: string;
  ssh: string;
  location: string;
};

export function HetznerSettings({
  draft,
  onChange,
  secrets,
}: {
  draft: HetznerDraft;
  onChange: (patch: Partial<HetznerDraft>) => void;
  secrets: OperatorStatus["secrets"];
}) {
  return (
    <>
      <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
        <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
          Hetzner Cloud
        </h2>
        <SecretField
          label="Cloud API token"
          value={draft.hcloud}
          onChange={(hcloud) => onChange({ hcloud })}
          stored={secrets.hcloud}
          hint="A read-write token from your Hetzner Cloud console. Sets HCLOUD_TOKEN, and stays in this project on this computer."
        />
        <Field label="Server region" hint="Where Hetzner creates the server. Sets SERVER_LOCATION.">
          <Input
            value={draft.location}
            onChange={(event) => onChange({ location: event.target.value })}
            placeholder="nbg1"
            className="max-w-40 font-mono"
          />
        </Field>
      </section>
      <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
        <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
          DNS and SSH
        </h2>
        <SecretField
          label="DNS API token"
          value={draft.dnsToken}
          onChange={(dnsToken) => onChange({ dnsToken })}
          stored={secrets.dnsToken}
          hint="Used for the A record that points at your server. Sets HETZNER_DNS_TOKEN, and stays on this computer."
        />
        <div className="flex flex-wrap gap-[var(--space-md)]">
          <div className="min-w-56 flex-1">
            <Field label="DNS zone" hint="The zone in Hetzner DNS that owns the hostname.">
              <Input
                value={draft.zone}
                onChange={(event) => onChange({ zone: event.target.value })}
                placeholder="example.com"
                className="font-mono"
              />
            </Field>
          </div>
          <div className="min-w-56 flex-1">
            <Field label="SSH key name" hint="A key that is already in your Hetzner project.">
              <Input
                value={draft.ssh}
                onChange={(event) => onChange({ ssh: event.target.value })}
                className="font-mono"
              />
            </Field>
          </div>
        </div>
      </section>
    </>
  );
}
