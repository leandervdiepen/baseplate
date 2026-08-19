import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/** The one raised surface in the studio. Depth comes from the shadow. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]"
    >
      {children}
    </h2>
  );
}
