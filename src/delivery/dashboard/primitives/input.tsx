import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

const fieldClass =
  "min-h-[var(--size-control)] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[length:var(--text-sm)] text-[var(--color-text)] outline-none transition-[border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] focus:border-[var(--color-accent)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-32 py-2 font-mono", className)} {...props} />;
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)] text-[var(--color-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      <Label>{label}</Label>
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
