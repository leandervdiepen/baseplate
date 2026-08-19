import { useCallback, useEffect, useState } from "react";
import { AuthPage } from "./features/auth.tsx";
import { FirstRun } from "./features/first-run.tsx";
import { LogsPage } from "./features/logs.tsx";
import { PoliciesPage } from "./features/policies.tsx";
import { SchemaPage } from "./features/schema.tsx";
import { SettingsPage } from "./features/settings.tsx";
import { TablesPage } from "./features/tables.tsx";
import { getStatus, provision, type OperatorStatus } from "./lib/operator-client.ts";
import { AppShell, type NavId } from "./patterns/app-shell.tsx";
import { Button } from "./primitives/button.tsx";
import { LogoMark } from "./primitives/icon.tsx";

export function App() {
  const [status, setStatus] = useState<OperatorStatus | null>(null);
  const [nav, setNav] = useState<NavId>("tables");
  const [table, setTable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getStatus()
      .then((next) => {
        setStatus(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to reach the operator.");
      });
  }, []);

  async function runProvision() {
    await provision();
    refresh();
  }

  useEffect(refresh, [refresh]);

  if (error && !status) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-md)] p-[var(--space-xl)] text-center">
        <h1 className="text-[length:var(--text-xl)] font-semibold tracking-[var(--tracking-tight)]">
          Baseplate is not answering
        </h1>
        <p className="max-w-[380px] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          The studio talks to a small server on this machine. Start it with{" "}
          <code className="font-mono">baseplate dashboard</code>, then try again.
        </p>
        <p className="font-mono text-[length:var(--text-xs)] text-[var(--color-danger)]">{error}</p>
        <Button onClick={refresh}>Try again</Button>
      </main>
    );
  }
  if (!status) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen items-center justify-center gap-2.5 text-[var(--color-text-muted)]"
      >
        <LogoMark />
        <span>Loading the studio…</span>
      </main>
    );
  }
  if (!status.configured) {
    return <FirstRun onDone={refresh} />;
  }

  return (
    <AppShell
      current={nav}
      onNavigate={setNav}
      apiUp={status.apiUp}
      target={status.target ?? "local"}
      baseUrl={status.baseUrl}
      leaf={nav === "tables" ? table : undefined}
    >
      {nav === "tables" ? (
        <TablesPage
          selected={table}
          onSelect={setTable}
          onNeedToken={() => setNav("auth")}
          onEditPolicy={() => setNav("policies")}
          onCreateTable={() => setNav("schema")}
          apiUp={status.apiUp}
          onProvision={runProvision}
        />
      ) : null}
      {nav === "schema" ? (
        <SchemaPage
          apiUp={status.apiUp}
          onOpenRows={() => setNav("tables")}
          onProvision={() => void runProvision()}
        />
      ) : null}
      {nav === "policies" ? <PoliciesPage /> : null}
      {nav === "logs" ? <LogsPage target={status.target ?? "local"} /> : null}
      {nav === "auth" ? <AuthPage baseUrl={status.baseUrl} /> : null}
      {nav === "settings" ? <SettingsPage status={status} onChanged={refresh} /> : null}
    </AppShell>
  );
}
