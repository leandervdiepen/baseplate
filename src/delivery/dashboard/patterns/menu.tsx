import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn.ts";

/**
 * A button and the choices it opens, following the menu button contract: the
 * trigger says what it opens, arrows walk the items, Escape closes without
 * choosing, and focus comes back either way.
 */
export function Menu({
  label,
  trigger,
  children,
  className,
  align = "start",
}: {
  /** What the trigger opens, for a reader who cannot see the list appear. */
  label: string;
  trigger: (props: { open: boolean }) => ReactNode;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<DOMRect | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    items(list.current)[0]?.focus();

    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (!wrap.current?.contains(target) && !list.current?.contains(target)) {
        setOpen(false);
      }
    }
    // Fixed to the viewport, so anything that moves the trigger under it makes
    // the position a lie. Closing is honest and is what a menu does anyway.
    function onMoved(): void {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onMoved);
    window.addEventListener("scroll", onMoved, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onMoved);
      window.removeEventListener("scroll", onMoved, true);
    };
  }, [open]);

  function toggle(): void {
    const trigger = wrap.current?.querySelector<HTMLElement>("[aria-haspopup]");
    setAt(trigger?.getBoundingClientRect() ?? null);
    setOpen((was) => !was);
  }

  function close(toTrigger: boolean): void {
    setOpen(false);
    if (toTrigger) {
      wrap.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    }
  }

  return (
    <div
      ref={wrap}
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close(true);
          return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
          return;
        }
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const all = items(list.current);
        const at = all.indexOf(document.activeElement as HTMLElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        all[(at + step + all.length) % all.length]?.focus();
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={toggle}
        className="w-full rounded-[var(--radius-md)] text-start transition-[scale] duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[var(--press-scale)]"
      >
        {trigger({ open })}
      </button>
      {open && at
        ? createPortal(
            <div
              ref={list}
              id={menuId}
              role="menu"
              aria-label={label}
              onClick={() => close(true)}
              style={{
                top: at.bottom + 4,
                ...(align === "end"
                  ? { right: Math.max(8, window.innerWidth - at.right) }
                  : { left: Math.max(8, at.left) }),
                minWidth: at.width,
              }}
              className={cn(
                // It grows out of the control that opened it, not out of the
                // middle of the screen, because that is where it came from. It
                // hangs off the body so a panel with its own scrollbar cannot
                // clip it.
                "menu-enter fixed z-50 w-max max-w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-xs)] shadow-[var(--shadow-raised)]",
                align === "end" ? "origin-top-right" : "origin-top-left",
              )}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function MenuItem({
  onSelect,
  children,
  selected,
  disabled,
}: {
  onSelect: () => void;
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full min-h-10 items-center gap-2.5 rounded-[calc(var(--radius-lg)-var(--space-xs))] px-2.5 text-start text-[length:var(--text-sm)] transition-[background-color,color] duration-[var(--duration-hover)] ease-[var(--ease-out)] disabled:opacity-50",
        selected
          ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-strong)]"
          : "hover:bg-[var(--color-bg-subtle)]",
      )}
    >
      {children}
    </button>
  );
}

function items(root: HTMLElement | null): HTMLElement[] {
  return [...(root?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
}
