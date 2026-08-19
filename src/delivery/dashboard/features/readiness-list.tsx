import type { ReadinessCheck } from "../lib/operator-client.ts";

export function ReadinessList({ checks }: { checks: ReadinessCheck[] }) {
  if (checks.length === 0) {
    return null;
  }
  const blocking = checks.filter((check) => !check.ok);
  return (
    <section className="flex flex-col gap-[var(--space-sm)] border-b border-[var(--color-border)] py-[var(--space-lg)]">
      <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)]">
        Before you provision
      </h2>
      <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {blocking.length === 0
          ? "Everything this target needs is in place."
          : `${blocking.length} thing${blocking.length === 1 ? "" : "s"} would fail a provision.`}
      </p>
      <ul className="mt-1 flex flex-col gap-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={
                check.ok
                  ? "mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-accent)]"
                  : "mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-danger)]"
              }
            />
            <span className="min-w-0">
              <span className="text-[length:var(--text-sm)]">{check.label}</span>
              <span className="sr-only">{check.ok ? " ready" : " not ready"}</span>
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
