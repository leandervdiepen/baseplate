import { useState } from "react";
import {
  provision,
  saveConfig,
  teardown,
  type OperatorStatus,
} from "../lib/operator-client.ts";
import { ReadinessList } from "./readiness-list.tsx";
import { TokenSettings } from "./token-settings.tsx";
import { Callout } from "../patterns/callout.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";
import { IconLock } from "../primitives/icon.tsx";
import { SecretField } from "../primitives/secret-field.tsx";
import { Segmented } from "../primitives/segmented.tsx";

export function SettingsPage({
  status,
  onChanged,
}: {
  status: OperatorStatus;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState(status.target ?? "local");
  const [zone, setZone] = useState(status.dnsZone ?? "");
  const [hcloud, setHcloud] = useState("");
  const [dnsToken, setDnsToken] = useState("");
  const [ssh, setSsh] = useState(status.sshKeyName ?? "");
  const [location, setLocation] = useState(status.serverLocation ?? "nbg1");
  const [hostname, setHostname] = useState(status.hostname);
  const [busy, setBusy] = useState(false);
  const [confirmDown, setConfirmDown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cloud = target === "hetzner";
  const blocking = status.readiness.filter((check) => !check.ok).length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveConfig({
        TARGET: target,
        HETZNER_DNS_ZONE: zone,
        HCLOUD_TOKEN: hcloud,
        HETZNER_DNS_TOKEN: dnsToken,
        SSH_KEY_NAME: ssh,
        SERVER_LOCATION: location,
        // Caddy asks Let's Encrypt for exactly the stack hostname, so the two
        // are one field here rather than two that must be kept equal by hand.
        SITE_ADDRESS: cloud ? hostname.trim() : ":8080",
        hostname: cloud ? hostname.trim() : "localhost",
      });
      setMessage("Saved locally in operator.env on this computer.");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  async function runProvision() {
    setBusy(true);
    setError(null);
    try {
      const result = await provision();
      setMessage(`Stack up at ${result.baseUrl}`);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Provision failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runTeardown() {
    setBusy(true);
    setError(null);
    try {
      await teardown();
      setConfirmDown(false);
      setMessage("Stack stopped.");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Teardown failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Provisioning target and operator credentials." />
      <Callout icon={<IconLock />} className="mb-[var(--space-lg)] max-w-[var(--container-form)]">
        These keys stay on this machine. Only database and JWT secrets are sent to a server;
        your Hetzner tokens never leave here.
      </Callout>
      <div className="flex max-w-[var(--container-form)] flex-col">
        <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] pb-[var(--space-lg)]">
          <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
            Target
          </h2>
          <Field label="TARGET" hint="Where the stack runs. Local needs no cloud keys.">
            <Segmented
              value={target}
              onChange={setTarget}
              options={[
                { id: "local", label: "local" },
                { id: "hetzner", label: "hetzner" },
              ]}
            />
          </Field>
          {cloud ? (
            <Field
              label="Hostname"
              hint="A name under your Hetzner DNS zone. Caddy gets a certificate for it."
            >
              <Input
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="api.example.com"
                className="font-mono"
              />
            </Field>
          ) : (
            <Hint>
              Local serves plain HTTP on 127.0.0.1 with no domain and no certificate.
            </Hint>
          )}
        </section>

        {cloud ? (
          <>
            <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
              <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
                Hetzner API
              </h2>
              <SecretField
                label="HCLOUD_TOKEN"
                value={hcloud}
                onChange={setHcloud}
                stored={status.secrets.hcloud}
                hint="Read-write token from the Hetzner console. Stored only in operator.env on this computer."
              />
              <Field label="SERVER_LOCATION" hint="Hetzner region for the server.">
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="max-w-40 font-mono"
                />
              </Field>
            </section>
            <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
              <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
                DNS and SSH
              </h2>
              <SecretField
                label="DNS_TOKEN"
                value={dnsToken}
                onChange={setDnsToken}
                stored={status.secrets.dnsToken}
                hint="For the A record pointing at your server. Stored only in operator.env on this computer."
              />
              <div className="flex gap-[var(--space-md)]">
                <Field label="DNS_ZONE" hint="The zone in Hetzner DNS that owns the hostname.">
                  <Input
                    value={zone}
                    onChange={(event) => setZone(event.target.value)}
                    placeholder="example.com"
                    className="font-mono"
                  />
                </Field>
                <Field label="SSH_KEY_NAME" hint="A key already in your Hetzner project.">
                  <Input
                    value={ssh}
                    onChange={(event) => setSsh(event.target.value)}
                    className="font-mono"
                  />
                </Field>
              </div>
            </section>
          </>
        ) : null}

        <TokenSettings status={status} onChanged={onChanged} />
        <ReadinessList checks={status.readiness} />

        {message ? (
          <p className="pt-[var(--space-md)] text-[length:var(--text-sm)] text-[var(--color-accent-strong)]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="pt-[var(--space-md)] text-[length:var(--text-sm)] text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2.5 border-t border-[var(--color-border)] pt-[var(--space-lg)]">
          <p className="max-w-xs text-[length:var(--text-xs)] leading-[var(--leading-tight)] text-[var(--color-text-muted)]">
            {blocking > 0
              ? "Provision will fail until the checks above pass."
              : "Provision creates or updates the server from these settings."}
          </p>
          <div className="ms-auto flex items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() => void runProvision()}
              disabled={busy || blocking > 0}
            >
              Provision
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              Save locally
            </Button>
          </div>
        </div>
        {confirmDown ? (
          <div className="mt-[var(--space-lg)] rounded-[var(--radius-md)] bg-[var(--color-danger-subtle)] p-4">
            <p className="mb-3 text-[length:var(--text-sm)]">Stop the stack and destroy its volumes?</p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => void runTeardown()} disabled={busy}>
                Teardown stack
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDown(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="mt-[var(--space-md)] self-start" onClick={() => setConfirmDown(true)}>
            Teardown
          </Button>
        )}
      </div>
    </>
  );
}
