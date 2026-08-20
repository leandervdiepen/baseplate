import { useEffect, useState } from "react";
import { formatBytes } from "../lib/format.ts";
import { getOverview, type Overview, type OperatorStatus } from "../lib/operator-client.ts";
import type { NavId } from "../patterns/nav.ts";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatCard } from "../patterns/stat-card.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { CopyButton } from "../primitives/copy-button.tsx";
import {
  IconBackups,
  IconLock,
  IconSchema,
  IconSettings,
  IconStorage,
  IconTables,
} from "../primitives/icon.tsx";

/**
 * What is true about this project right now, in the order somebody would ask.
 * Is it up, what is in it, and when was it last proven restorable.
 */
export function OverviewPage({
  status,
  onNavigate,
  onProvision,
}: {
  status: OperatorStatus;
  onNavigate: (id: NavId) => void;
  onProvision: () => Promise<void>;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOverview()
      .then(setOverview)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read this project.");
      });
  }, [status.apiUp]);

  const url = status.baseUrl ?? "http://127.0.0.1:8080";

  return (
    <>
      <PageHeader
        title={status.project.name}
        description={status.project.path}
        actions={
          status.apiUp ? (
            <div className="flex items-center gap-[var(--space-sm)]">
              <code className="truncate rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-1.5 font-mono text-[length:var(--text-sm)]">
                {url}
              </code>
              <CopyButton value={url} label="Copy the API URL" />
            </div>
          ) : (
            <Button
              busy={busy}
              onClick={() => {
                setBusy(true);
                void onProvision().finally(() => setBusy(false));
              }}
            >
              Start the stack
            </Button>
          )
        }
      />

      <StatusMessage message={error} tone="error" className="mb-4 block" />

      <div className="grid max-w-[var(--container-content)] gap-[var(--space-md)] sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<span className={status.apiUp ? "text-[var(--color-accent)]" : ""}>●</span>}
          label="Status"
          value={status.apiUp ? "Up" : "Not running"}
          tone={status.apiUp ? "good" : "bad"}
          detail={
            status.apiUp
              ? "Postgres, the API, auth, storage, and backups are answering."
              : "Nothing is answering. Start the stack to use this project."
          }
        />
        <StatCard
          icon={<IconSettings />}
          label="Target"
          value={status.target === "hetzner" ? "Hetzner" : "This machine"}
          detail={
            status.target === "hetzner"
              ? `${status.hostname}, in your own account`
              : "Docker on 127.0.0.1. No cloud account needed."
          }
          action={
            <Button variant="ghost" className="px-2" onClick={() => onNavigate("settings")}>
              Settings
            </Button>
          }
        />
        <StatCard
          icon={<IconTables />}
          label="Tables"
          value={overview ? String(overview.tables) : "—"}
          detail={
            overview && overview.tables > 0
              ? `${count(overview.rowsTracked, "column")}, every table under row security`
              : "None yet. A table comes up already protected."
          }
          action={
            <Button variant="ghost" className="px-2" onClick={() => onNavigate("tables")}>
              Open tables
            </Button>
          }
        />
        <StatCard
          icon={<IconStorage />}
          label="Storage"
          value={overview ? `${String(overview.objects)} objects` : "—"}
          detail={
            overview && overview.buckets > 0
              ? `${count(overview.buckets, "bucket")}, ${formatBytes(overview.objectBytes)}`
              : "No buckets yet. Files follow the same rule as rows."
          }
          action={
            <Button variant="ghost" className="px-2" onClick={() => onNavigate("storage")}>
              Open storage
            </Button>
          }
        />
        <StatCard
          icon={<IconBackups />}
          label="Last backup"
          value={overview?.lastBackup ? when(overview.lastBackup.at) : "None yet"}
          tone={overview?.lastBackup?.ok === false ? "bad" : "plain"}
          detail={
            overview?.lastBackup
              ? `${formatBytes(overview.lastBackup.bytes)} to ${overview.lastBackup.destination}`
              : "One runs on a schedule as soon as the stack is up."
          }
        />
        <StatCard
          icon={<IconLock />}
          label="Last verified restore"
          value={overview?.lastDrill ? when(overview.lastDrill.at) : "Not yet"}
          tone={overview?.lastDrill ? (overview.lastDrill.ok ? "good" : "bad") : "warn"}
          detail={
            overview?.lastDrill?.ok
              ? `${count(overview.lastDrill.tables, "table")} and ${count(overview.lastDrill.rows, "row")} came back, in ${String(overview.lastDrill.durationMs)}ms`
              : "A backup nobody has restored is a hope."
          }
          action={
            <Button variant="ghost" className="px-2" onClick={() => onNavigate("backups")}>
              Open backups
            </Button>
          }
        />
      </div>

      {overview?.lastChange ? (
        <section className="mt-[var(--space-lg)] max-w-[var(--container-content)]">
          <h2 className="mb-[var(--space-sm)] flex items-center gap-2 text-[length:var(--text-sm)] font-medium">
            <IconSchema />
            Last schema change
          </h2>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            <span className="font-mono">{overview.lastChange.change}</span>, applied{" "}
            {when(overview.lastChange.appliedAt)}, and recorded in your database.
          </p>
        </section>
      ) : null}
    </>
  );
}

function count(value: number, noun: string): string {
  return `${String(value)} ${noun}${value === 1 ? "" : "s"}`;
}

/** Recent time reads better as an interval; older reads better as a date. */
function when(iso: string): string {
  if (!iso) {
    return "—";
  }
  const at = new Date(iso);
  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${String(minutes)} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${String(hours)} hour${hours === 1 ? "" : "s"} ago`;
  }
  return at.toLocaleDateString();
}
