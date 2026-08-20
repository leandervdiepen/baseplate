import { useState } from "react";
import { client } from "../client.ts";

/**
 * The page the emailed recovery link lands on: {SITE_URL}/reset-password?token=...
 * On success the SDK adopts the session it gets back, so the app is already
 * signed in by the time this unmounts.
 */
export function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    if (!token) {
      setError("That link has no token in it. Ask for a new email.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error: failure } = await client.auth.confirmPasswordReset({ token, password });
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    onDone();
  }

  return (
    <div className="centre">
      <form
        className="card signin"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <h1>Choose a new password</h1>
          <p className="hint">
            This signs you in and ends every other session you had open.
          </p>
        </div>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="hint">At least 8 characters.</p>
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Set password"}
          </button>
          <button className="button ghost" type="button" disabled={busy} onClick={onDone}>
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}
