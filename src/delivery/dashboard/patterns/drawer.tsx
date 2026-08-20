import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../primitives/button.tsx";

/**
 * A panel over the page, for work that belongs to what is already on screen:
 * inserting a row, editing a table, reading a policy. The page stays behind it
 * rather than being replaced, because none of those are somewhere else to go.
 *
 * Escape closes it, focus moves in on open and back to whatever opened it on
 * close, and everything behind is inert so a screen reader does not wander out
 * of the panel while it is up.
 */
export function Drawer({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) {
        return;
      }
      // Tab past the last control comes back to the first, so focus cannot
      // leave a panel that is covering everything behind it.
      const stops = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = stops[0];
      const last = stops.at(-1);
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Clicking away closes, and it is a button so it is not a click target
          nobody can reach from a keyboard. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-scrim)]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="drawer-enter relative flex h-full w-[min(34rem,100%)] flex-col overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)]"
      >
        <header className="sticky top-0 z-10 flex items-start gap-[var(--space-md)] border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-lg)] py-[var(--space-md)]">
          <div className="min-w-0 grow">
            <h2
              id={headingId}
              className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" className="-me-2 px-2" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="grow px-[var(--space-lg)] py-[var(--space-lg)]">{children}</div>
      </div>
    </div>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
