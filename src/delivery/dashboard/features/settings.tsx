import { useState } from "react";
import {
  OperatorError,
  provision,
  saveConfig,
  teardown,
  type OperatorStatus,
} from "../lib/operator-client.ts";
import { HetznerSettings, type HetznerDraft } from "./hetzner-settings.tsx";
import { ReadinessList } from "./readiness-list.tsx";
import { SessionSettings } from "./session-settings.tsx";
import { Callout } from "../patterns/callout.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";
import { IconLock } from "../primitives/icon.tsx";
import { Segmented } from "../primitives/segmented.tsx";

export function SettingsPage({
  status,
  onChanged,
}: {
  status: OperatorStatus;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState(status.target ?? "local");
  const [access, setAccess] = useState(status.accessTokenTtl);
  const [refreshTtl, setRefreshTtl] = useState(status.refreshTokenTtl);
  const [hetzner, setHetzner] = useState<HetznerDraft>({
    hostname: status.hostname === "localhost" ? "" : status.hostname,
    zone: status.dnsZone ?? "",
    hcloud: "",
    dnsToken: "",
    ssh: status.sshKeyName ?? "",
    location: status.serverLocation ?? "nbg1",
  });
  const [busy, setBusy] = useState<"save" | "provision" | "teardown" | null>(null);
  const [confirmDown, setConfirmDown] = useState(false);
  /** Set when another project holds the ports, so we can offer to take them. */
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cloud = target === "hetzner";
  const blocking = status.readiness.filter((check) => !check.ok).length;

  async function act(kind: "save" | "provision" | "teardown", run: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      await run();
      onChanged();
    } catch (cause) {
      if (cause instanceof OperatorError && cause.code === "stack.another_running") {
        setBlockedBy(cause.message);
      }
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    act("save", async () => {
      await saveConfig({
        TARGET: target,
        HETZNER_DNS_ZONE: hetzner.zone,
        HCLOUD_TOKEN: hetzner.hcloud,
        HETZNER_DNS_TOKEN: hetzner.dnsToken,
        SSH_KEY_NAME: hetzner.ssh,
        SERVER_LOCATION: hetzner.location,
        ACCESS_TOKEN_TTL: access.trim(),
        REFRESH_TOKEN_TTL: refreshTtl.trim(),
        // Caddy asks Let's Encrypt for exactly the stack hostname, so the two
        // are one field here rather than two that must be kept equal by hand.
        SITE_ADDRESS: cloud ? hetzner.hostname.trim() : ":8080",
        hostname: cloud ? hetzner.hostname.trim() : "localhost",
      });
      setMessage("Saved to baseplate.env in this project. Start the stack to apply it.");
    });

  return (
    <>
      <PageHeader title="Settings" description="Where the stack runs, and the keys it needs." />
      <Callout icon={<IconLock />} className="mb-[var(--space-lg)] max-w-[var(--container-form)]">
        These keys stay on this machine. Only the database and JWT secrets are sent to a server;
        your Hetzner tokens never leave here.
      </Callout>
      <form
        className="flex max-w-[var(--container-form)] flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section className="flex flex-col gap-[var(--space-md)] border-b border-[var(--color-border)] pb-[var(--space-lg)]">
          <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
            Target
          </h2>
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
        </section>

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
        {target === (status.target ?? "local") ? (
          <ReadinessList checks={status.readiness} />
        ) : (
          /* The checks came back for the saved target. Showing them next to an
             unsaved one would vouch for something nobody has looked at. */
          <section className="border-b border-[var(--color-border)] py-[var(--space-lg)]">
            <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
              Before you start the stack
            </h2>
            <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              Save these settings to check what {target === "hetzner" ? "Hetzner" : "this machine"}{" "}
              still needs.
            </p>
          </section>
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
              busy={busy === "provision"}
              disabled={blocking > 0}
              onClick={() =>
                void act("provision", async () => {
                  setBlockedBy(null);
                  const result = await provision();
                  setMessage(`Stack up at ${result.baseUrl}`);
                })
              }
            >
              Start the stack
            </Button>
            <Button type="submit" busy={busy === "save"}>
              Save settings
            </Button>
          </div>
          <div className="w-full">
            <StatusMessage message={message} />
            <StatusMessage message={error} tone="error" />
            {blockedBy ? (
              <Button
                variant="secondary"
                className="mt-[var(--space-sm)]"
                busy={busy === "provision"}
                onClick={() =>
                  void act("provision", async () => {
                    setBlockedBy(null);
                    const result = await provision(true);
                    setMessage(`Stack up at ${result.baseUrl}`);
                  })
                }
              >
                Stop the other stack and start this one
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="mt-[var(--space-lg)] flex max-w-[var(--container-form)] flex-col items-start gap-[var(--space-sm)]">
        <Button
          variant="secondary"
          busy={busy === "teardown" && !confirmDown}
          onClick={() =>
            void act("teardown", async () => {
              await teardown(false);
              setMessage("Stopped. Your data is still here; start the stack to bring it back.");
            })
          }
        >
          Stop the stack
        </Button>

        {confirmDown ? (
          <div className="w-full rounded-[var(--radius-md)] bg-[var(--color-danger-subtle)] p-4">
            <p className="mb-3 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">
              Delete this project's database volume? Every row goes with it, and nothing brings
              them back.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                busy={busy === "teardown"}
                onClick={() =>
                  void act("teardown", async () => {
                    await teardown(true);
                    setConfirmDown(false);
                    setMessage("Destroyed: containers, volumes, and any server.");
                  })
                }
              >
                Delete the data
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDown(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="px-2" onClick={() => setConfirmDown(true)}>
            Destroy this project's data
          </Button>
        )}
      </div>
    </>
  );
}
