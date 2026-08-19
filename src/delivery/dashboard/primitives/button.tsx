import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";
import { Spinner } from "./icon.tsx";

const buttonStyles = cva(
  // Tailwind compiles `scale-*` to the `scale` property, so `scale` is what the
  // transition has to name. Listing `transform` here would silently do nothing.
  "relative inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-md)] px-[var(--space-md)] text-[length:var(--text-base)] font-medium leading-[var(--leading-tight)] transition-[scale,background-color,color,box-shadow,border-color] duration-[var(--duration-press)] ease-[var(--ease-out)] disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[var(--shadow-control)] hover:bg-[var(--color-accent-strong)]",
        secondary:
          "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] shadow-[var(--shadow-control)] hover:bg-[var(--color-bg-subtle)]",
        danger:
          "bg-[var(--color-danger)] text-[var(--color-on-accent)] shadow-[var(--shadow-control)] hover:bg-[var(--color-danger-strong)]",
        ghost: "text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    /** Skip the press scale where movement would distract rather than confirm. */
    static?: boolean;
    /** Work is in flight. The label stays put so the button does not resize. */
    busy?: boolean;
  };

export function Button({
  className,
  variant,
  type = "button",
  static: isStatic,
  busy,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? busy}
      aria-busy={busy || undefined}
      className={cn(
        buttonStyles({ variant }),
        !isStatic && "active:enabled:scale-[var(--press-scale)]",
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-[var(--space-sm)]", busy && "opacity-0")}>
        {children}
      </span>
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}
