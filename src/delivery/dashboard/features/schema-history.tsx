import type { SchemaHistoryEntry } from "../lib/api/index.ts";
import { CodeBlock } from "../patterns/code-block.tsx";
import { Title } from "../primitives/heading.tsx";

export function SchemaHistory({ entries }: { entries: SchemaHistoryEntry[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section className="mt-[var(--space-xl)] max-w-[var(--container-content)]">
      <Title>Schema history</Title>
      <p className="mt-1 mb-[var(--space-md)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        Every change this database has taken, recorded by the database itself.
      </p>
      <ol className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-mono text-[length:var(--text-sm)]">{entry.change}</h3>
              <time
                dateTime={entry.appliedAt}
                className="ms-auto shrink-0 text-[length:var(--text-xs)] tabular-nums text-[var(--color-text-muted)]"
              >
                {new Date(entry.appliedAt).toLocaleString()}
              </time>
            </div>
            <CodeBlock className="text-[var(--color-text-muted)]">{entry.statement}</CodeBlock>
          </li>
        ))}
      </ol>
    </section>
  );
}
