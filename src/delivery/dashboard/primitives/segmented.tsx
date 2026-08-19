import { useRef } from "react";
import { cn } from "../lib/cn.ts";

type Option<T extends string> = { id: T; label: string; disabled?: boolean };

/**
 * A radio group, so it follows the radio group keyboard contract: one tab stop,
 * arrow keys move the selection between the options.
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
        "inline-flex h-[var(--size-control)] w-[280px] max-w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[3px]",
        className,
      )}
    >
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
              "flex h-[32px] min-h-0 flex-1 items-center justify-center rounded-[calc(var(--radius-md)-3px)] text-[length:var(--text-sm)] leading-[var(--leading-chip)] transition-[background-color,color,box-shadow] duration-[var(--duration-hover)] ease-[var(--ease-out)] disabled:opacity-50",
              selected
                ? "bg-[var(--color-bg)] font-semibold text-[var(--color-text)] shadow-[var(--shadow-control)]"
                : "font-medium text-[var(--color-text-muted)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
