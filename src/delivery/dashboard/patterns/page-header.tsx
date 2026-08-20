import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** What this page is for, rather than what it contains. */
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[var(--space-lg)] flex flex-wrap items-start gap-[var(--space-md)]">
      <div className="min-w-0 grow">
        <h1 className="text-[length:var(--text-xl)] font-semibold tracking-[var(--tracking-tight)] leading-[var(--leading-title)]">
          {title}
        </h1>
        {description ? (
          /* It wraps. A sentence cut off at the width of the window says less
             than the sentence, and the reader cannot get the rest of it. */
          <p className="mt-1.5 max-w-[var(--container-content)] text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
