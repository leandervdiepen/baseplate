import { CodeBlock } from "../patterns/code-block.tsx";
import { Card } from "../primitives/card.tsx";
import { StatusPill } from "../primitives/chip.tsx";

const OPERATIONS = ["SELECT", "INSERT", "UPDATE", "DELETE"];

export function PolicyCard({ table, ownerColumn }: { table: string; ownerColumn: string }) {
  const name = `${table}_owner`;
  const sql = `CREATE POLICY ${name} ON ${table}
  USING (${ownerColumn} = baseplate.caller_id())
  WITH CHECK (${ownerColumn} = baseplate.caller_id());`;

  return (
    <Card className="overflow-clip">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="font-mono text-[length:var(--text-sm)] font-medium">{name}</h2>
        <p className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          on public.{table}
        </p>
        <StatusPill tone="accent">enabled</StatusPill>
      </header>
      <div className="space-y-4 px-5 py-4">
        <section>
          <h3 className="text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            Rule
          </h3>
          <p className="mt-2 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">
            A caller sees rows where <code className="font-mono">{ownerColumn}</code> matches the{" "}
            <code className="font-mono">sub</code> of their token. New rows are stamped with that
            sub on insert.
          </p>
        </section>
        <section>
          <h3 className="text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            Applies to
          </h3>
          {/* Plain text, not chips: nothing here is clickable and it should not
              pretend otherwise. */}
          <p className="mt-2 font-mono text-[length:var(--text-sm)]">{OPERATIONS.join(" · ")}</p>
        </section>
        <section>
          <h3 className="mb-2 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            In the database
          </h3>
          <CodeBlock>{sql}</CodeBlock>
        </section>
      </div>
    </Card>
  );
}
