import { useRef } from "react";
import { cn } from "../lib/cn.ts";

type Option<T extends string> = { id: T; label: string; disabled?: boolean };

/**
 * A radio group, so it follows the radio group keyboard contract: one tab stop,
 * arrow keys move the selection between the options.
 *
 * The selected surface is one element that slides, not a background that
 * appears on one option while it disappears from another. Two fading boxes read
 * as two things; one that travels reads as the same thing, moved, which is what
 * actually happened.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
  className,
}: {
  value: T;
  options: Option<T>[];
  onChange: (id: T) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(
    options.findIndex((option) => option.id === value),
    0,
  );

  function move(from: number, step: number): void {
    const total = options.length;
    for (let hop = 1; hop <= total; hop += 1) {
      const next = (from + step * hop + total * total) % total;
      const option = options[next];
      if (option && !option.disabled && !disabled) {
        onChange(option.id);
        buttons.current[next]?.focus();
        return;
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-flex h-[var(--size-control)] w-[280px] max-w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[3px]",
        className,
      )}
    >
      {/* Decoration for what `aria-checked` already says, so it is hidden and
          takes no clicks of its own. */}
      <span
        aria-hidden="true"
        style={{
          width: `calc((100% - 6px) / ${String(options.length)})`,
          translate: `calc(${String(at)} * 100%) 0`,
        }}
        className="pointer-events-none absolute inset-y-[3px] left-[3px] rounded-[calc(var(--radius-md)-3px)] bg-[var(--color-bg)] shadow-[var(--shadow-control)] transition-[translate] duration-[var(--duration-move)] ease-[var(--ease-in-out)]"
      />
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              // Concentric with the 3px track padding: 8 - 3 = 5.
              "relative z-10 flex h-[32px] min-h-0 flex-1 items-center justify-center rounded-[calc(var(--radius-md)-3px)] text-[length:var(--text-sm)] leading-[var(--leading-chip)] transition-[color,scale] duration-[var(--duration-press)] ease-[var(--ease-out)] active:enabled:scale-[var(--press-scale)] disabled:opacity-50",
              selected
                ? "font-semibold text-[var(--color-text)]"
                : "font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
