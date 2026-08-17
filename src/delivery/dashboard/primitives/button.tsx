import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

const buttonStyles = cva(
  "inline-flex min-h-[var(--size-control)] min-w-[var(--size-control)] items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-md)] px-[var(--space-md)] text-[length:var(--text-base)] font-medium leading-[var(--leading-tight)] transition-[transform,background-color,color,opacity,border-color] duration-[var(--duration-press)] ease-[var(--ease-out)] disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-strong)]",
        secondary:
          "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]",
        danger: "bg-[var(--color-danger)] text-[var(--color-on-accent)] hover:opacity-90",
        ghost: "text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    static?: boolean;
  };

export function Button({
  className,
  variant,
  type = "button",
  static: isStatic,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        buttonStyles({ variant }),
        !isStatic && "active:enabled:scale-[0.96]",
        className,
      )}
      {...props}
    />
  );
}
