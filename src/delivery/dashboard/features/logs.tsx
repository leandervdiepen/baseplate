import { useEffect, useMemo, useState } from "react";
import { getLogs } from "../lib/operator-client.ts";
import { PageHeader } from "../patterns/page-header.tsx";
import { Button } from "../primitives/button.tsx";
import { IconSearch } from "../primitives/icon.tsx";
import { Input } from "../primitives/input.tsx";
import { Segmented } from "../primitives/segmented.tsx";
import { cn } from "../lib/cn.ts";

type LogLine = { service: string; message: string; error: boolean };

function parseLogs(text: string): LogLine[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+\|\s?(.*)$/);
      const service = match?.[1] ?? "compose";
      const message = match?.[2] ?? line;
      return {
        service,
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
  const [service, setService] = useState("all");

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      setText(await getLogs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read logs.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const lines = useMemo(() => parseLogs(text), [text]);
  const services = useMemo(
    () => ["all", ...Array.from(new Set(lines.map((line) => line.service)))],
    [lines],
  );
  const visible = lines.filter((line) => {
    if (service !== "all" && line.service !== service) {
      return false;
    }
    if (query && !line.message.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Logs"
        description="Compose, Caddy, PostgREST and Postgres in one stream."
      />
      <div className="mb-[var(--space-md)] flex flex-wrap items-center gap-3">
        <Segmented
          value={target === "hetzner" ? "hetzner" : "local"}
          options={[
            { id: "local", label: "Local" },
            { id: "hetzner", label: "Hetzner", disabled: target !== "hetzner" },
          ]}
          onChange={() => undefined}
        />
        <div className="flex flex-wrap gap-1.5">
          {services.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setService(name)}
              className={cn(
                "h-10 rounded-[var(--radius-pill)] px-3 text-[length:var(--text-sm)] font-medium transition-[background-color,color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                service === name
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                  : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
              )}
            >
              {name === "all" ? "All" : name}
            </button>
          ))}
        </div>
        <div className="relative ms-auto min-w-[12rem]">
          <IconSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter logs…"
            className="ps-9"
          />
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={busy} static>
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      <div className="flex min-h-[28rem] flex-col overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-md)] py-2.5">
          <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">Buffered</span>
          <span className="text-[length:var(--text-xs)] tabular-nums text-[var(--color-text-muted)]">
            {visible.length} lines · {target} target
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {visible.length === 0 ? (
            <p className="p-[var(--space-md)] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              No log lines yet.
            </p>
          ) : (
            visible.map((line, index) => (
              <div
                key={`${line.service}-${index}`}
                className={cn(
                  "flex gap-3 px-[var(--space-md)] py-1.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-snug)]",
                  line.error && "bg-[var(--color-danger-subtle)]",
                )}
              >
                <span
                  className={cn(
                    "w-28 shrink-0",
                    line.error ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {line.service}
                </span>
                <span className="min-w-0">{line.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
