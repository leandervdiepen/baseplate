import type { ReadinessCheck } from "../lib/api/types.ts";
import { Section } from "../patterns/section.tsx";
import { IconCheck } from "../primitives/icon.tsx";

export function ReadinessList({ checks }: { checks: ReadinessCheck[] }) {
  if (checks.length === 0) {
    return null;
  }
  const blocking = checks.filter((check) => !check.ok).length;

  return (
    <Section
      title="Before you start the stack"
      description={
        blocking === 0
          ? "Everything this target needs is in place."
          : `${String(blocking)} thing${blocking === 1 ? "" : "s"} would fail.`
      }
    >
      <ul className="flex flex-col gap-2">
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
              <span className="sr-only">{check.ok ? ", ready" : ", not ready"}</span>
              {check.ok ? null : (
                <span className="block text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
                  {check.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
