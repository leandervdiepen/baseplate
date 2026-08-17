import { useEffect, useState } from "react";
import { getStack, type StackShape } from "../lib/operator-client.ts";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusPill } from "../primitives/chip.tsx";

export function PoliciesPage() {
  const [stack, setStack] = useState<StackShape | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getStack()
      .then(setStack)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load policies.");
      });
  }, []);

  return (
    <>
      <PageHeader
        title="Policies"
        description="Row-level security for the public schema. One policy per table, written in product language."
      />
      {error ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      <div className="max-w-[760px] space-y-[var(--space-md)]">
        {(stack?.accessPolicies ?? []).map((policy) => (
          <PolicyCard key={policy.table} table={policy.table} ownerColumn={policy.ownerColumn} />
        ))}
      </div>
    </>
  );
}

function PolicyCard({ table, ownerColumn }: { table: string; ownerColumn: string }) {
  const name = `${table}_owner`;
  const sql = `CREATE POLICY ${name} ON ${table}
  USING (${ownerColumn} = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid)
  WITH CHECK (${ownerColumn} = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid);`;

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
            Generated SQL
          </p>
          <pre className="overflow-auto rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] p-4 font-mono text-[length:var(--text-xs)] leading-[var(--leading-snug)]">
            {sql}
          </pre>
        </div>
        <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          Defined in stack/postgres/init.sh. Rebuild the stack to change it.
        </p>
      </div>
    </article>
  );
}
