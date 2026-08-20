import { cn } from "../lib/cn.ts";

/**
 * Up or down, in the smallest mark that can carry it. Colour alone never says
 * it: every place this appears also writes the state in words nearby, and the
 * dot itself is hidden from a screen reader so it is not read as a bullet.
 */
export function StatusDot({ ok, small }: { ok: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-[var(--radius-pill)]",
        small ? "size-[var(--size-dot-sm)]" : "size-[var(--size-dot)]",
        ok ? "bg-[var(--color-accent)]" : "bg-[var(--color-danger)]",
      )}
    />
  );
}
