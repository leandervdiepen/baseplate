import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Title } from "../primitives/heading.tsx";

/**
 * A titled band of a long page. Every one was writing out the same heading
 * classes by hand, and half of them had drifted apart by a line-height, so the
 * page had two sizes of the same heading.
 */
export function Section({
  title,
  description,
  actions,
  divided = true,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** Sits on the heading's line, pushed to the end. */
  actions?: ReactNode;
  /** Off for the last section on a page, where a rule would close nothing. */
  divided?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-[var(--space-md)] py-[var(--space-lg)]",
        divided && "border-b border-[var(--color-border)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-[var(--space-md)]">
        <Title>{title}</Title>
        {actions ? <div className="ms-auto shrink-0">{actions}</div> : null}
      </div>
      {description ? (
        <p className="-mt-[var(--space-sm)] text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}
