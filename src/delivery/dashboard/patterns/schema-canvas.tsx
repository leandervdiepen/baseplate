import type { ReactNode } from "react";

export function SchemaCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="schema-canvas min-h-[28rem] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] p-[var(--space-xl)]">
      {children}
    </div>
  );
}
