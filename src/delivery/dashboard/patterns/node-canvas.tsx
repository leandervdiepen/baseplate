import { useEffect, useRef, useState, type ReactNode } from "react";

type Line = { id: string; from: DOMRect; to: DOMRect };

/** Two ends of one line, each naming an element's `data-anchor`. */
export type NodeLink = { from: string; to: string };

/**
 * Nodes in columns, left to right, with a line between the anchors a caller
 * names. Measured from what was rendered rather than from the layout that asked
 * for it, so a wrapped or scrolled canvas still draws them in the right place.
 */
export function NodeCanvas({
  columns,
  links,
  highlighted,
  renderNode,
}: {
  columns: readonly (readonly string[])[];
  links: readonly NodeLink[];
  highlighted: string | null;
  renderNode: (id: string) => ReactNode;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  // Compared by value: `links` is rebuilt on every render, and depending on its
  // identity would measure, set state, and measure again forever.
  const shape = links.map((link) => `${link.from}->${link.to}`).join("|");

  useEffect(() => {
    function measure(): void {
      const root = canvas.current;
      if (!root) {
        return;
      }
      const base = root.getBoundingClientRect();
      const found: Line[] = [];
      for (const link of links) {
        const from = root.querySelector(anchor(link.from));
        const to = root.querySelector(anchor(link.to));
        if (from && to) {
          found.push({
            id: `${link.from}->${link.to}`,
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
    // Re-measured whenever the shape being drawn changes.
  }, [shape]);

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
      className="node-canvas relative min-h-[28rem] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] p-[var(--space-xl)]"
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
            {column.map((id) => {
              const node = renderNode(id);
              return node ? (
                <div
                  key={id}
                  data-card={id}
                  className={
                    highlighted === id
                      ? "rounded-[var(--radius-lg)] outline outline-2 outline-offset-2 outline-[var(--color-accent)]"
                      : undefined
                  }
                >
                  {node}
                </div>
              ) : null;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function anchor(id: string): string {
  return `[data-anchor="${id}"]`;
}

/** Canvas-relative, and scroll-aware, so a line stays on its node. */
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
