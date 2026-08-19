import type { ReadinessCheck } from "../lib/operator-client.ts";
import { IconCheck } from "../primitives/icon.tsx";

export function ReadinessList({ checks }: { checks: ReadinessCheck[] }) {
  if (checks.length === 0) {
    return null;
  }
  const blocking = checks.filter((check) => !check.ok).length;

  return (
    <section className="flex flex-col gap-[var(--space-sm)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
      <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
        Before you start the stack
      </h2>
      <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {blocking === 0
          ? "Everything this target needs is in place."
          : `${blocking} thing${blocking === 1 ? "" : "s"} would fail.`}
      </p>
      <ul className="mt-1 flex flex-col gap-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2.5">
            {/* Shape as well as colour, so the state survives a colour-blind
                reader and a black and white screenshot. */}
            <span
              aria-hidden="true"
              className={
                check.ok
                  ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)]"
              }
            >
              {check.ok ? <IconCheck size={11} /> : <span className="text-[10px] leading-none">!</span>}
            </span>
            <span className="min-w-0">
              <span className="text-[length:var(--text-sm)]">{check.label}</span>
              <span className="sr-only">{check.ok ? " — ready" : " — not ready"}</span>
              {check.ok ? null : (
                <span className="block text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
                  {check.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
