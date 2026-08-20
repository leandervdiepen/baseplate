import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Title } from "../primitives/heading.tsx";
import { Button } from "../primitives/button.tsx";

/**
 * A panel over the page, for work that belongs to what is already on screen:
 * inserting a row, editing a table, reading a policy. The page stays behind it
 * rather than being replaced, because none of those are somewhere else to go.
 *
 * It renders outside the app so the app itself can be made `inert` while it is
 * up. That is stronger than trapping Tab: it takes the page behind away from
 * the pointer and the screen reader too, not only from the keyboard.
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
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Play the exit, then let the parent unmount us. Skipped when motion is not wanted. */
  const requestClose = useCallback((): void => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setLeaving(true);
    timer.current = setTimeout(onClose, exitMs());
  }, [onClose]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    opener.current = document.activeElement;
    const app = document.getElementById("root");
    const scrollWas = document.body.style.overflow;
    if (app) {
      app.inert = true;
    }
    document.body.style.overflow = "hidden";

    // A field that asked for focus keeps it. Otherwise the panel takes focus
    // itself, so its title is what gets read rather than its close button.
    if (!panel.current?.contains(document.activeElement)) {
      panel.current?.focus();
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = scrollWas;
      if (app) {
        app.inert = false;
      }
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [requestClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Clicking away closes, and it is a button so it is not a click target
          nobody can reach from a keyboard. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={requestClose}
        className={`absolute inset-0 cursor-default bg-[var(--color-scrim)] ${leaving ? "scrim-leave" : "scrim-enter"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={`relative flex h-full w-[min(34rem,100%)] flex-col overflow-y-auto overscroll-contain border-s border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)] focus:outline-none ${leaving ? "drawer-leave" : "drawer-enter"}`}
      >
        <header className="sticky top-0 z-10 flex items-start gap-[var(--space-md)] border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-lg)] py-[var(--space-md)]">
          <div className="min-w-0 grow">
            <Title id={headingId}>{title}</Title>
            {description ? (
              <p className="mt-1 text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" className="-me-2 px-2" onClick={requestClose}>
            Close
          </Button>
        </header>
        <div className="grow px-[var(--space-lg)] py-[var(--space-lg)]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Read from the token rather than repeated here, so the two cannot disagree. */
function exitMs(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--duration-exit");
  return Number.parseFloat(value) || 160;
}
