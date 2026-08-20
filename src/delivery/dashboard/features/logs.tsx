import { useMemo, useState } from "react";
import { useLogs } from "./use-logs.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { IconLogs, IconSearch } from "../primitives/icon.tsx";
import { Input } from "../primitives/input.tsx";
import { TogglePills } from "../primitives/toggle-pills.tsx";
import { cn } from "../lib/cn.ts";

const ALL = "all";

export function LogsPage({ target }: { target: string }) {
  const { lines, busy, error, refresh } = useLogs();
  const [query, setQuery] = useState("");
  const [service, setService] = useState(ALL);

  const services = useMemo(
    () => [ALL, ...Array.from(new Set(lines.map((line) => line.service)))],
    [lines],
  );
  const visible = lines.filter(
    (line) =>
      (service === ALL || line.service === service) &&
      (!query || line.message.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Logs"
        description={`Compose, Caddy, PostgREST, auth and Postgres in one stream, from the ${target} stack.`}
      />
      <div className="mb-[var(--space-md)] flex flex-wrap items-center gap-[var(--space-md)]">
        <TogglePills
          label="Filter by service"
          value={service}
          onChange={setService}
          options={services.map((name) => ({
            id: name,
            label: name === ALL ? "All services" : name,
          }))}
        />
        <div className="relative ms-auto min-w-[12rem] flex-1 sm:max-w-64">
          <IconSearch
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <Input
            type="search"
            aria-label="Filter log lines"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter log lines…"
            className="ps-9"
          />
        </div>
        <Button variant="secondary" onClick={refresh} busy={busy} static>
          Refresh
        </Button>
      </div>
      <StatusMessage message={error} tone="error" className="mb-4 block" />
      <div className="flex min-h-[24rem] flex-col overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-raised)]">
        <div className="flex items-center justify-end gap-3 border-b border-[var(--color-border)] px-[var(--space-md)] py-2.5">
          {/* The active filter is already named in the toolbar above, so this
              heading is for the reader who cannot see it. */}
          <h2 className="sr-only">Log output</h2>
          <p aria-live="polite" className="text-[length:var(--text-xs)] tabular-nums text-[var(--color-text-muted)]">
            {visible.length} of {lines.length} lines
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {visible.length === 0 ? (
            <EmptyState
              icon={<IconLogs width={20} height={20} />}
              title={lines.length === 0 ? "No log lines yet" : "Nothing matches that filter"}
              description={
                lines.length === 0
                  ? "The stack writes here as it starts and serves requests. Refresh once it has done something."
                  : `No line from ${service === ALL ? "any service" : service} contains "${query}".`
              }
              action={
                lines.length > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setService(ALL);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={refresh} busy={busy}>
                    Refresh
                  </Button>
                )
              }
            />
          ) : (
            <ol>
              {visible.map((line, index) => (
                <li
                  key={`${line.service}-${index}`}
                  className={cn(
                    "flex gap-3 px-[var(--space-md)] py-1.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-snug)]",
                    line.error && "bg-[var(--color-danger-subtle)]",
                  )}
                >
                  <span
                    className={cn(
                      "w-24 shrink-0",
                      line.error ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]",
                    )}
                  >
                    {line.service}
                  </span>
                  <span className="min-w-0 break-words">{line.message}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
