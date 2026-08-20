import { useEffect, useState } from "react";
import {
  getBackups,
  runBackupJob,
  type BackupState,
  type DrillRecord,
} from "../lib/api/index.ts";
import { formatBytes } from "../lib/format.ts";
import { Callout } from "../patterns/callout.tsx";
import { Cell, DataTable, Row } from "../patterns/table.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { Stat } from "../patterns/stat-card.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card } from "../primitives/card.tsx";
import { Title } from "../primitives/heading.tsx";
import { CodeBlock } from "../patterns/code-block.tsx";
import { IconBackups, IconLock } from "../primitives/icon.tsx";

export function BackupsPage() {
  const [state, setState] = useState<BackupState | null>(null);
  const [busy, setBusy] = useState<"backup" | "drill" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBackups()
      .then(setState)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read your backups.");
        setState({ live: false, backups: [], drills: [] });
      });
  }, []);

  async function run(kind: "backup" | "drill") {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const next = await runBackupJob(kind);
      setState(next);
      setMessage(next.message ?? "Done.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  const lastDrill = state?.drills[0];
  const offMachine = state?.backups[0]?.destination.startsWith("this machine") === false;

  return (
    <>
      <PageHeader
        title="Backups"
        description="Dumps of your database, sealed with a key only you hold, plus the drills that prove one actually restores."
      />
      <StatusMessage message={message} className="mb-4 block" />
      <StatusMessage message={error} tone="error" className="mb-4 block" />

      <div className="max-w-[var(--container-content)] space-y-[var(--space-md)]">
        <Card className="p-[var(--space-lg)]">
          <DrillVerdict drill={lastDrill} />
          <div className="mt-[var(--space-lg)] flex flex-wrap gap-2.5">
            <Button busy={busy === "backup"} onClick={() => void run("backup")}>
              Back up now
            </Button>
            <Button variant="secondary" busy={busy === "drill"} onClick={() => void run("drill")}>
              Run a drill
            </Button>
          </div>
        </Card>

        {state && state.backups.length > 0 && !offMachine ? (
          <Callout icon={<IconLock width={16} height={16} />}>
            These backups are on the same machine as the database, which does not survive losing
            the machine. Name an S3 bucket in <span className="font-mono">baseplate.env</span> to
            send them somewhere else.
          </Callout>
        ) : null}

        {state && state.backups.length === 0 ? (
          <EmptyState
            icon={<IconBackups width={20} height={20} />}
            title="Nothing backed up yet"
            description="One runs on a schedule as soon as the stack is up. Take one now if you would rather not wait."
          />
        ) : null}

        {state && state.backups.length > 0 ? (
          <DataTable
            caption="Backups, newest first"
            columns={[
              { key: "when", label: "When", width: "13rem" },
              { key: "size", label: "Size", width: "7rem" },
              { key: "where", label: "Where" },
              { key: "state", label: "State", width: "7rem" },
            ]}
          >
            {state.backups.map((backup) => (
              <Row key={backup.id}>
                <Cell mono width="13rem">
                  {backup.finishedAt ? new Date(backup.finishedAt).toLocaleString() : "running…"}
                </Cell>
                <Cell mono width="7rem">
                  {formatBytes(backup.bytes)}
                </Cell>
                <Cell muted>{backup.destination}</Cell>
                <Cell width="7rem">
                  <span
                    className={
                      backup.ok ? "text-[var(--color-text-muted)]" : "text-[var(--color-danger)]"
                    }
                  >
                    {backup.ok ? "sealed" : "failed"}
                  </span>
                </Cell>
              </Row>
            ))}
          </DataTable>
        ) : null}

        <Card className="p-[var(--space-lg)]">
          <Title>Putting one back</Title>
          <p className="mt-1 mb-[var(--space-md)] text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
            Restoring replaces the live database and loses everything since that backup, so it is a
            command rather than a button, and it asks you to type this project&apos;s name first.
          </p>
          <CodeBlock>{"baseplate backup list\nbaseplate restore <id>"}</CodeBlock>
        </Card>
      </div>
    </>
  );
}

/**
 * The one number that matters: whether a backup has been restored, recently,
 * and what came back. A list of files does not tell anyone that.
 */
function DrillVerdict({ drill }: { drill: DrillRecord | undefined }) {
  if (!drill) {
    return (
      <Stat
        label="Last verified restore"
        value="Not yet"
        tone="warn"
        detail="A drill downloads the newest backup, opens it, restores it into a database of its own, and counts what came back."
      />
    );
  }
  return (
    <Stat
      label="Last verified restore"
      tone={drill.ok ? "good" : "bad"}
      value={drill.ok ? new Date(drill.ranAt).toLocaleString() : "Failed"}
      detail={
        drill.ok
          ? `${String(drill.tables)} table${drill.tables === 1 ? "" : "s"}, ${String(drill.rows)} row${drill.rows === 1 ? "" : "s"}, restored and counted in ${String(drill.durationMs)}ms.`
          : (drill.message ?? "The drill did not finish.")
      }
    />
  );
}

