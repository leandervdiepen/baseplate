import { useEffect, useState } from "react";
import {
  getHistory,
  getSchema,
  type SchemaHistoryEntry,
  type SchemaSnapshot,
} from "../lib/operator-client.ts";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusPill } from "../primitives/chip.tsx";

export function PoliciesPage() {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [history, setHistory] = useState<SchemaHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSchema()
      .then(setSchema)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load policies.");
      });
    void getHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  return (
    <>
      <PageHeader
        title="Policies"
        description="Row-level security on your tables. One policy per table, applied by the stack, not by the dashboard."
      />
      {error ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      <div className="max-w-[760px] space-y-[var(--space-md)]">
        {(schema?.tables ?? []).map((table) => (
          <PolicyCard
            key={table.name}
            table={table.name}
            ownerColumn={table.ownerColumn}
          />
        ))}
      </div>
      <SchemaHistory entries={history} />
    </>
  );
}

function PolicyCard({ table, ownerColumn }: { table: string; ownerColumn: string }) {
  const name = `${table}_owner`;
  const sql = `CREATE POLICY ${name} ON ${table}
  USING (${ownerColumn} = baseplate.caller_id())
  WITH CHECK (${ownerColumn} = baseplate.caller_id());`;

  return (
    <article className="overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="font-mono text-[length:var(--text-sm)]">
          public.{table} {name}
        </div>
        <StatusPill tone="accent">enabled</StatusPill>
      </header>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            Rule
          </p>
          <p className="mt-2 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">
            A caller sees rows where{" "}
            <code className="font-mono text-[length:var(--text-xs)]">{ownerColumn}</code> matches the{" "}
            <code className="font-mono text-[length:var(--text-xs)]">sub</code> of their token. New
            rows are stamped with the caller's sub on insert.
          </p>
        </div>
        <div>
          <p className="mb-2 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            Applies to
          </p>
          <div className="flex gap-[var(--space-sm)]">
            {["SELECT", "INSERT", "UPDATE", "DELETE"].map((op) => (
              <span
                key={op}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-1 font-mono text-[length:var(--text-xs)]"
              >
                {op}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            In the database
          </p>
          <pre className="overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
            {sql}
          </pre>
        </div>
      </div>
    </article>
  );
}

function SchemaHistory({ entries }: { entries: SchemaHistoryEntry[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section className="mt-[var(--space-xl)] max-w-[760px]">
      <h2 className="mb-1 text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
        Schema history
      </h2>
      <p className="mb-[var(--space-md)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        Every change this database has taken, recorded by the database itself.
      </p>
      <ol className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[length:var(--text-sm)]">{entry.change}</span>
              <time
                dateTime={entry.appliedAt}
                className="ms-auto shrink-0 text-[length:var(--text-xs)] tabular-nums text-[var(--color-text-muted)]"
              >
                {new Date(entry.appliedAt).toLocaleString()}
              </time>
            </div>
            <pre className="mt-2 overflow-auto font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)] text-[var(--color-text-muted)]">
              {entry.statement}
            </pre>
          </li>
        ))}
      </ol>
    </section>
  );
}
