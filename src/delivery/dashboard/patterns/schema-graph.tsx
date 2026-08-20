import { useEffect, useRef, useState, type ReactNode } from "react";
import { columnsOfCards, edgesBetween, layoutTables } from "../lib/schema-layout.ts";
import type { SchemaSnapshot } from "../lib/operator-client.ts";
import { SchemaCard } from "./schema-card.tsx";

type Line = { id: string; from: DOMRect; to: DOMRect };

/**
 * Tables as cards, with a line drawn from each foreign key to what it points
 * at. A table sits one column right of whatever it references, so every line
 * runs left to right.
 *
 * The lines are decoration: `SchemaRelations` under the canvas is the readable
 * version, and it is not a duplicate so much as the accessible original.
 */
export function SchemaGraph({
  tables,
  highlighted,
  footerFor,
}: {
  tables: SchemaSnapshot["tables"];
  highlighted: string | null;
  footerFor?: (table: string) => ReactNode;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const layout = layoutTables(tables);
  const columns = columnsOfCards(layout);
  const edges = edgesBetween(tables);

  // Measured from what was actually rendered, so a wrapped or scrolled canvas
  // draws lines where the cards really are.
  useEffect(() => {
    function measure(): void {
      const root = canvas.current;
      if (!root) {
        return;
      }
      const base = root.getBoundingClientRect();
      const found: Line[] = [];
      for (const edge of edges) {
        const from = root.querySelector(anchor(edge.from, edge.fromColumn));
        const to = root.querySelector(anchor(edge.to, edge.toColumn));
        if (from && to) {
          found.push({
            id: `${edge.from}.${edge.fromColumn}->${edge.to}.${edge.toColumn}`,
            from: shift(from.getBoundingClientRect(), base, root),
            to: shift(to.getBoundingClientRect(), base, root),
          });
        }
      }
      setLines(found);
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (canvas.current) {
      observer.observe(canvas.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
    // Re-measured whenever the shape of the schema changes.
  }, [tables]);

  useEffect(() => {
    if (highlighted) {
      canvas.current
        ?.querySelector(`[data-card="${highlighted}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [highlighted]);

  return (
    <div
      ref={canvas}
      className="schema-canvas relative min-h-[28rem] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] p-[var(--space-xl)]"
    >
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
        {lines.map((line) => (
          <path
            key={line.id}
            d={curve(line)}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ))}
      </svg>
      <div className="relative flex items-start gap-[var(--space-xl)]">
        {columns.map((column, index) => (
          <div key={index} className="flex flex-col gap-[var(--space-lg)]">
            {column.map((name) => {
              const table = tables.find((entry) => entry.name === name);
              return table ? (
                <div
                  key={name}
                  data-card={name}
                  className={
                    highlighted === name
                      ? "rounded-[var(--radius-lg)] outline outline-2 outline-offset-2 outline-[var(--color-accent)]"
                      : undefined
                  }
                >
                  <SchemaCard
                    name={table.name}
                    columns={table.columns}
                    {...(footerFor ? { footer: footerFor(table.name) } : {})}
                  />
                </div>
              ) : null;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function anchor(table: string, column: string): string {
  return `[data-anchor="${table}.${column}"]`;
}

/** Canvas-relative, and scroll-aware, so a line stays on its card. */
function shift(rect: DOMRect, base: DOMRect, root: HTMLElement): DOMRect {
  return new DOMRect(
    rect.left - base.left + root.scrollLeft,
    rect.top - base.top + root.scrollTop,
    rect.width,
    rect.height,
  );
}

function curve(line: Line): string {
  const startX = line.from.right;
  const startY = line.from.top + line.from.height / 2;
  const endX = line.to.left;
  const endY = line.to.top + line.to.height / 2;
  const bend = Math.max(24, (endX - startX) / 2);
  return `M ${String(startX)} ${String(startY)} C ${String(startX + bend)} ${String(startY)}, ${String(endX - bend)} ${String(endY)}, ${String(endX)} ${String(endY)}`;
}
