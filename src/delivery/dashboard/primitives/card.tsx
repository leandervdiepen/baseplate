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
