import type { OperatorStatus } from "../lib/api/index.ts";
import { HostnameField } from "./hostname-field.tsx";
import { useHetznerAccount } from "./use-hetzner-account.ts";
import { Section } from "../patterns/section.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";
import { SecretField } from "../primitives/secret-field.tsx";
import { Select } from "../primitives/select.tsx";

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
  const { account, checking, check } = useHetznerAccount(secrets);

  const known = account?.cloud.ok === true;
  const zonesKnown = account?.dns.ok === true;

  return (
    <>
      <Section
        title="Hetzner Cloud"
        actions={
          <Button variant="secondary" busy={checking} onClick={check}>
            Check my account
          </Button>
        }
      >
        <SecretField
          label="Cloud API token"
          value={draft.hcloud}
          onChange={(hcloud) => onChange({ hcloud })}
          stored={secrets.hcloud}
          hint="A read-write token from your Hetzner Cloud console. Sets HCLOUD_TOKEN, and stays in this project on this computer."
        />
        {account ? (
          <StatusMessage
            message={account.cloud.message}
            tone={account.cloud.ok ? "info" : "error"}
          />
        ) : null}

        {known ? (
          <Field label="Server region" hint="Read from your account. Sets SERVER_LOCATION.">
            <Select
              value={draft.location}
              onChange={(event) => onChange({ location: event.target.value })}
            >
              {account?.locations.map((location) => (
                <option key={location.name} value={location.name}>
                  {location.name} · {location.description}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Server region" hint="Where Hetzner creates the server. Sets SERVER_LOCATION.">
            <Input
              value={draft.location}
              onChange={(event) => onChange({ location: event.target.value })}
              placeholder="nbg1"
              className="max-w-40 font-mono"
            />
          </Field>
        )}
      </Section>

      <Section title="DNS and SSH">
        <SecretField
          label="DNS API token"
          value={draft.dnsToken}
          onChange={(dnsToken) => onChange({ dnsToken })}
          stored={secrets.dnsToken}
          hint="Used for the A record that points at your server. Sets HETZNER_DNS_TOKEN, and stays on this computer."
        />
        {account ? (
          <StatusMessage message={account.dns.message} tone={account.dns.ok ? "info" : "error"} />
        ) : null}

        <div className="flex flex-wrap gap-[var(--space-md)]">
          <div className="min-w-56 flex-1">
            {zonesKnown && (account?.zones.length ?? 0) > 0 ? (
              <Field label="DNS zone" hint="The zones in your Hetzner DNS account.">
                <Select
                  value={draft.zone}
                  onChange={(event) => onChange({ zone: event.target.value })}
                >
                  <option value="">Pick a zone</option>
                  {account?.zones.map((zone) => (
                    <option key={zone.name} value={zone.name}>
                      {zone.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field
                label="DNS zone"
                hint={
                  zonesKnown
                    ? "This account has no DNS zones yet. Add your domain in Hetzner DNS first."
                    : "The zone in Hetzner DNS that owns the hostname."
                }
              >
                <Input
                  value={draft.zone}
                  onChange={(event) => onChange({ zone: event.target.value })}
                  placeholder="example.com"
                  className="font-mono"
                />
              </Field>
            )}
          </div>
          <div className="min-w-56 flex-1">
            {known && (account?.sshKeys.length ?? 0) > 0 ? (
              <Field label="SSH key" hint="The keys already in your Hetzner project.">
                <Select value={draft.ssh} onChange={(event) => onChange({ ssh: event.target.value })}>
                  <option value="">Pick a key</option>
                  {account?.sshKeys.map((key) => (
                    <option key={key.name} value={key.name}>
                      {key.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field
                label="SSH key name"
                hint={
                  known
                    ? "This account has no SSH keys yet. Upload one in Hetzner Cloud first."
                    : "A key that is already in your Hetzner project."
                }
              >
                <Input
                  value={draft.ssh}
                  onChange={(event) => onChange({ ssh: event.target.value })}
                  className="font-mono"
                />
              </Field>
            )}
          </div>
        </div>
        {!account ? (
          <Hint>Save your tokens, then check the account to pick a zone and a key from it.</Hint>
        ) : null}

        <HostnameField
          zone={draft.zone}
          hostname={draft.hostname}
          onChange={(hostname) => onChange({ hostname })}
        />
      </Section>
    </>
  );
}
