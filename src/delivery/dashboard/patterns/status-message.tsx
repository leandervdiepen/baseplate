import { cn } from "../lib/cn.ts";

/**
 * The region exists whether or not there is anything to say. A live region
 * inserted at the same moment as its text is announced unreliably.
 */
export function StatusMessage({
  message,
  tone = "info",
  className,
}: {
  message: string | null;
  tone?: "info" | "error";
  className?: string;
}) {
  const error = tone === "error";
  return (
    <p
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      className={cn(
        "text-[length:var(--text-sm)] leading-[var(--leading-snug)] empty:hidden",
        error ? "text-[var(--color-danger)]" : "text-[var(--color-accent-strong)]",
        message ? className : undefined,
      )}
    >
      {message}
    </p>
  );
}
