import { cn } from "../lib/cn.ts";

export type Pill<T extends string> = { id: T; label: string };

/**
 * A row of filters where any one of them can be the current one. Each is a
 * button carrying its own `aria-pressed`, rather than a radio group, because
 * pressing one is a view of the same page and not a value being chosen.
 */
export function TogglePills<T extends string>({
  label,
  options,
  value,
  onChange,
  mono,
  className,
}: {
  label: string;
  options: Pill<T>[];
  value: T;
  onChange: (id: T) => void;
  /** For values that are literals, like a token lifetime. */
  mono?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-h-10 rounded-[var(--radius-md)] border px-3 text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)] transition-[background-color,color,border-color,scale] duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[var(--press-scale)]",
              mono && "font-mono text-[length:var(--text-xs)]",
              selected
                ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-strong)]"
                : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
