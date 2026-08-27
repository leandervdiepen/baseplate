import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "../primitives/button.tsx";

/**
 * The last thing between a click and something irreversible. Inline rather than
 * a dialog, because it belongs to the row it is about and the middle of the
 * screen would take away the context that makes it answerable. Opening it moves
 * focus here so it is read out, and Escape backs out.
 */
export function ConfirmInline({
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  className,
}: {
  /** The question, in full, naming exactly what goes. */
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const questionId = useId();

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <div
      ref={box}
      tabIndex={-1}
      role="group"
      aria-labelledby={questionId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
      className={cn(
        "reveal rounded-[var(--radius-lg)] bg-[var(--color-danger-subtle)] p-[var(--space-md)] focus:outline-none",
        className,
      )}
    >
      <p
        id={questionId}
        className="mb-[var(--space-md)] text-[length:var(--text-sm)] leading-[var(--leading-snug)]"
      >
        {children}
      </p>
      <div className="flex flex-wrap gap-[var(--space-sm)]">
        <Button variant="danger" busy={busy ?? false} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy ?? false}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
