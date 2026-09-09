import { useState } from "react";
import type { OperatorStatus } from "../lib/api/index.ts";
import { ApiSettings } from "./api-settings.tsx";
import { BackupSettings } from "./backup-settings.tsx";
import { EmailSettings } from "./email-settings.tsx";
import { HetznerSettings, type HetznerDraft } from "./hetzner-settings.tsx";
import { StorageSettings } from "./storage-settings.tsx";
import { ReadinessList } from "./readiness-list.tsx";
import { SessionSettings } from "./session-settings.tsx";
import { StackTeardown } from "./stack-teardown.tsx";
import { useSettings } from "./use-settings.ts";
import { Callout } from "../patterns/callout.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { Section } from "../patterns/section.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Hint } from "../primitives/input.tsx";
import { IconLock } from "../primitives/icon.tsx";
import { Segmented } from "../primitives/segmented.tsx";

export function SettingsPage({
  status,
  onChanged,
}: {
  status: OperatorStatus;
  onChanged: () => void;
}) {
  const settings = useSettings(onChanged);
  const [target, setTarget] = useState(status.target ?? "local");
  const [access, setAccess] = useState(status.accessTokenTtl);
  const [refreshTtl, setRefreshTtl] = useState(status.refreshTokenTtl);
  const [hetzner, setHetzner] = useState<HetznerDraft>({
    hostname: status.hostname === "localhost" ? "" : status.hostname,
    zone: status.dnsZone ?? "",
    hcloud: "",
    ssh: status.sshKeyName ?? "",
    location: status.serverLocation ?? "nbg1",
  });

  const cloud = target === "hetzner";
  const blocking = status.readiness.filter((check) => !check.ok).length;

  const save = () =>
    settings.save({
      TARGET: target,
      HETZNER_DNS_ZONE: hetzner.zone,
      HCLOUD_TOKEN: hetzner.hcloud,
      SSH_KEY_NAME: hetzner.ssh,
      SERVER_LOCATION: hetzner.location,
      ACCESS_TOKEN_TTL: access.trim(),
      REFRESH_TOKEN_TTL: refreshTtl.trim(),
      // Caddy asks Let's Encrypt for exactly the stack hostname, so the two
      // are one field here rather than two that must be kept equal by hand.
      SITE_ADDRESS: cloud ? hetzner.hostname.trim() : ":8080",
      BASEPLATE_HOSTNAME: cloud ? hetzner.hostname.trim() : "localhost",
    });

  return (
    <>
      <PageHeader title="Settings" description="Where the stack runs, and the keys it needs." />
      <Callout icon={<IconLock />} className="mb-[var(--space-lg)] max-w-[var(--container-form)]">
        Your Hetzner token never leaves this machine. What a server is given is what it has to use:
        the database and JWT secrets, and whichever mail, object store and backup credentials you
        have filled in below.
      </Callout>
      <form
        className="flex max-w-[var(--container-form)] flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Section title="Target" className="pt-0">
          <Segmented
            label="Where the stack runs"
            value={target}
            onChange={setTarget}
            options={[
              { id: "local", label: "This machine" },
              { id: "hetzner", label: "Hetzner" },
            ]}
          />
          {cloud ? null : (
            <Hint>
              This machine serves plain HTTP on 127.0.0.1, with no cloud account, no domain, and no
              certificate.
            </Hint>
          )}
        </Section>

        {cloud ? (
          <HetznerSettings
            draft={hetzner}
            secrets={status.secrets}
            onChange={(patch) => setHetzner((current) => ({ ...current, ...patch }))}
          />
        ) : null}

        <SessionSettings
          access={access}
          refresh={refreshTtl}
          onAccess={setAccess}
          onRefresh={setRefreshTtl}
        />
        <ApiSettings draft={settings.config} onChange={settings.change} />
        <EmailSettings
          draft={settings.config}
          cloud={cloud}
          secretStored={settings.storedSecrets.SMTP_PASS ?? false}
          onChange={settings.change}
        />
        <StorageSettings
          draft={settings.config}
          storedSecrets={settings.storedSecrets}
          onChange={settings.change}
        />
        <BackupSettings
          draft={settings.config}
          secretStored={settings.storedSecrets.BACKUP_S3_SECRET_KEY ?? false}
          onChange={settings.change}
        />
        {target === (status.target ?? "local") ? (
          <ReadinessList checks={status.readiness} />
        ) : (
          /* The checks came back for the saved target. Showing them next to an
             unsaved one would vouch for something nobody has looked at. */
          <Section
            title="Before you start the stack"
            description={`Save these settings to check what ${target === "hetzner" ? "Hetzner" : "this machine"} still needs.`}
          />
        )}

        <div className="flex flex-wrap items-center gap-[var(--space-md)] pt-[var(--space-lg)]">
          <p className="max-w-xs text-[length:var(--text-xs)] leading-[var(--leading-tight)] text-[var(--color-text-muted)]">
            {blocking > 0
              ? "Starting the stack will fail until the checks above pass."
              : "Save first, then start the stack to apply these settings."}
          </p>
          <div className="ms-auto flex items-center gap-2.5">
            <Button
              variant="secondary"
              busy={settings.busy === "provision"}
              disabled={blocking > 0}
              onClick={() => void settings.start()}
            >
              Start the stack
            </Button>
            <Button type="submit" busy={settings.busy === "save"}>
              Save settings
            </Button>
          </div>
          <div className="w-full">
            <StatusMessage message={settings.message} />
            <StatusMessage message={settings.error} tone="error" />
            {settings.blockedBy ? (
              <Button
                variant="secondary"
                className="mt-[var(--space-sm)]"
                busy={settings.busy === "provision"}
                onClick={() => void settings.start(true)}
              >
                Stop the other stack and start this one
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <StackTeardown
        busy={settings.busy === "teardown"}
        onStop={() => void settings.stop()}
        onDestroy={settings.destroy}
      />
    </>
  );
}
