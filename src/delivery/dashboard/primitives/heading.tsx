import type { ReactNode } from "react";

/**
 * The one heading that names a thing inside a page: a card, a section, a panel.
 * It exists once so those three cannot drift apart, which they had.
 */
export function Title({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]"
    >
      {children}
    </h2>
  );
}
