import { useId } from "react";
import type { ComponentPropsWithRef, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { FieldContext, useFieldProps } from "./field-context.ts";

const fieldClass =
  "min-h-[var(--size-control)] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[length:var(--text-sm)] text-[var(--color-text)] transition-[border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] focus:border-[var(--color-accent)] aria-[invalid]:border-[var(--color-danger)]";

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cn(fieldClass, className)} {...useFieldProps()} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(fieldClass, "min-h-32 py-2 font-mono", className)}
      {...useFieldProps()}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
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

export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p
      id={id}
      className="text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]"
    >
      {children}
    </p>
  );
}

/**
 * A label, its control, and the text that explains it, wired together. The hint
 * sits under the label rather than under the control so it is read before the
 * field is filled in, not after.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className="flex flex-col gap-[var(--space-sm)]">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <Hint id={hintId}>{hint}</Hint> : null}
        {children}
        {error ? (
          <p
            id={errorId}
            className="text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext>
  );
}
