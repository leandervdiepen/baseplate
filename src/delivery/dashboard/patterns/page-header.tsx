export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-[var(--space-lg)]">
      <h1 className="text-[length:var(--text-xl)] font-semibold tracking-[var(--tracking-tight)] leading-[var(--leading-title)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 text-[length:var(--text-sm)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
