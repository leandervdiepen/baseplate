import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/**
 * Code is never reflowed to fit. It scrolls inside its own box so the page
 * itself never gains a horizontal scrollbar.
 */
export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]",
        className,
      )}
    >
      <code>{children}</code>
    </pre>
  );
}
