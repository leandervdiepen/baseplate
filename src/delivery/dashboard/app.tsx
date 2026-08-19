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
import { LogoMark } from "./primitives/icon.tsx";

export function App() {
  const [status, setStatus] = useState<OperatorStatus | null>(null);
  const [nav, setNav] = useState<NavId>("tables");
  const [sessionAt, setSessionAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getStatus()
      .then(setStatus)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to reach operator HTTP.");
      });
  }, []);

  async function runProvision() {
    await provision();
    refresh();
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-[var(--color-danger)]">
        {error}
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2.5 text-[var(--color-text-muted)]">
        <LogoMark />
        <span>Loading…</span>
      </div>
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
      sessionAt={sessionAt}
    >
      {nav === "tables" ? (
        <TablesPage
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
      {nav === "auth" ? <AuthPage onIssued={() => setSessionAt(Date.now())} baseUrl={status.baseUrl} /> : null}
      {nav === "settings" ? <SettingsPage status={status} onChanged={refresh} /> : null}
    </AppShell>
  );
}
