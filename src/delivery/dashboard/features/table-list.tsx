import { useState } from "react";
import { cn } from "../lib/cn.ts";
import type { SchemaSnapshot } from "../lib/operator-client.ts";
import { Button } from "../primitives/button.tsx";
import { Field, Input } from "../primitives/input.tsx";

/**
 * The tables in this schema, and the one being looked at. It is a list rather
 * than a dropdown because the whole point of the page is moving between them.
 */
export function TableList({
  tables,
  selected,
  onSelect,
  onNewTable,
}: {
  tables: SchemaSnapshot["tables"];
  selected: string | null;
  onSelect: (name: string) => void;
  onNewTable: () => void;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const shown = term ? tables.filter((table) => table.name.toLowerCase().includes(term)) : tables;

  return (
    <div className="flex w-[var(--size-table-rail)] shrink-0 flex-col gap-[var(--space-md)]">
      <div>
        <p className="mb-[var(--space-sm)] text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
          schema public
        </p>
        <Field label="Find a table" hideLabel>
          <Input
            type="search"
            value={query}
            placeholder="notes"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>

      <ul className="flex flex-col gap-0.5">
        {shown.map((table) => {
          const current = table.name === selected;
          return (
            <li key={table.name}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => onSelect(table.name)}
                className={cn(
                  "flex min-h-10 w-full items-center rounded-[var(--radius-md)] px-2.5 text-start font-mono text-[length:var(--text-sm)] transition-[background-color,color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                  current
                    ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent-strong)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]",
                )}
              >
                <span className="truncate">{table.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {term && shown.length === 0 ? (
        <p className="px-2.5 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          No table matches “{query}”.
        </p>
      ) : null}

      <Button variant="secondary" className="w-full" onClick={onNewTable}>
        New table
      </Button>
    </div>
  );
}
