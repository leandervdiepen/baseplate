import type { ComponentPropsWithRef } from "react";
import { cn } from "../lib/cn.ts";
import { useFieldProps } from "./field-context.ts";

export function Select({ className, ...props }: ComponentPropsWithRef<"select">) {
  return (
    <select
      className={cn(
        "min-h-[var(--size-control)] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 font-mono text-[length:var(--text-sm)] text-[var(--color-text)] transition-[border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] focus:border-[var(--color-accent)]",
        className,
      )}
      {...useFieldProps()}
      {...props}
    />
  );
}
