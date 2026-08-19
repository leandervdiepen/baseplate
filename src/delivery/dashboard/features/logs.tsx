import { useEffect, useMemo, useState } from "react";
import { getLogs } from "../lib/operator-client.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { IconLogs, IconSearch } from "../primitives/icon.tsx";
import { Input } from "../primitives/input.tsx";
import { cn } from "../lib/cn.ts";

type LogLine = { service: string; message: string; error: boolean };

const ALL = "all";

/** Compose numbers every replica. One of each is not worth the suffix. */
function serviceName(raw: string): string {
  return raw.replace(/-\d+$/, "");
}

function parseLogs(text: string): LogLine[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+\|\s?(.*)$/);
      const message = match?.[2] ?? line;
      return {
        service: serviceName(match?.[1] ?? "compose"),
        message,
        error: /error|fatal|panic|timeout|reset by peer/i.test(message),
      };
    });
}

export function LogsPage({ target }: { target: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [service, setService] = useState(ALL);

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setText(await getLogs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read the logs from Docker.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const lines = useMemo(() => parseLogs(text), [text]);
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
        <div role="group" aria-label="Filter by service" className="flex flex-wrap gap-1.5">
          {services.map((name) => {
            const selected = service === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={selected}
                onClick={() => setService(name)}
                className={cn(
                  "min-h-10 rounded-[var(--radius-md)] px-3 text-[length:var(--text-sm)] font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                  selected
                    ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-strong)] shadow-[var(--shadow-control)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]",
                )}
              >
                {name === ALL ? "All services" : name}
              </button>
            );
          })}
        </div>
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
        <Button variant="secondary" onClick={() => void refresh()} busy={busy} static>
          Refresh
        </Button>
      </div>
      <StatusMessage message={error} tone="error" className="mb-4 block" />
      <div className="flex min-h-[24rem] flex-col overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-raised)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-[var(--space-md)] py-2.5">
          <h2 className="text-[length:var(--text-sm)] font-medium">
            {service === ALL ? "All services" : service}
          </h2>
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
                  <Button variant="secondary" onClick={() => void refresh()} busy={busy}>
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
