import { useState } from "react";
import { firstRunLocal, provision } from "../lib/api/index.ts";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { LogoMark } from "../primitives/icon.tsx";

export function FirstRun({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLocal(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await firstRunLocal();
      await provision();
      onDone();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start the stack. Check that Docker is running.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="empty-enter flex min-h-screen flex-col items-center justify-center px-[var(--space-xl)] text-center">
      <LogoMark />
      <h1 className="mt-5 mb-[var(--space-sm)] text-[length:var(--text-xl)] font-semibold tracking-[var(--tracking-tight)] leading-[var(--leading-title)]">
        Start on this machine
      </h1>
      <p className="mb-[var(--space-lg)] max-w-[420px] text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
        No domain and no Hetzner account needed. Secrets are generated for this project and stay on
        this computer. You can point it at Hetzner later from Settings.
      </p>
      <div className="flex flex-col items-center gap-3">
        <StatusMessage message={error} tone="error" />
        <Button onClick={() => void startLocal()} busy={busy}>
          Start the local stack
        </Button>
      </div>
    </main>
  );
}
