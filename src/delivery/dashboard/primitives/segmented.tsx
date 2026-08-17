import { cn } from "../lib/cn.ts";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex h-[var(--size-control)] w-[280px] max-w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[3px]"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex h-[32px] min-h-0 flex-1 items-center justify-center rounded-[var(--radius-sm)] text-[length:var(--text-sm)] leading-[var(--leading-chip)] transition-[background-color,color,border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] disabled:opacity-50",
              selected
                ? "border border-[var(--color-border)] bg-[var(--color-bg)] font-semibold text-[var(--color-text)]"
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
