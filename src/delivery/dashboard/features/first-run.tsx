import { useState } from "react";
import { firstRunLocal, provision } from "../lib/operator-client.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { Button } from "../primitives/button.tsx";

export function FirstRun({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLocal() {
    setBusy(true);
    setError(null);
    try {
      await firstRunLocal();
      await provision();
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "First-run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-[var(--space-xl)]">
      <EmptyState
        title="Start on this machine"
        description="No domain and no Hetzner account needed. Secrets stay in this project on this computer, and you can point it at Hetzner later from Settings."
        action={
          <div className="flex flex-col items-center gap-3">
            {error ? (
              <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
            ) : null}
            <Button onClick={() => void startLocal()} disabled={busy}>
              {busy ? "Starting…" : "Start local stack"}
            </Button>
          </div>
        }
      />
    </div>
  );
}
