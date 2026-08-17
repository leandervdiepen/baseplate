import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export function MonoChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text)]">
      {children}
    </span>
  );
}

export function StatusPill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--text-xs)] font-medium leading-[var(--leading-chip)]",
        tone === "accent"
          ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-strong)]"
          : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

export function CapsLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
      {children}
    </span>
  );
}
