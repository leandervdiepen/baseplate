import { useRef, useState } from "react";
import { client } from "../client.ts";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signup" | "login" | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function submit(kind: "signup" | "login"): Promise<void> {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter an email address and a password.");
      emailRef.current?.focus();
      return;
    }
    setBusy(kind);
    try {
      const input = { email: email.trim(), password };
      await (kind === "signup" ? client.auth.signUp(input) : client.auth.signIn(input));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work. Check the details.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="centre">
      <form
        className="card signin"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("login");
        }}
      >
        <div>
          <h1>Kanban</h1>
          <p className="hint">Your boards are yours. Nobody else's caller can read a row of them.</p>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            ref={emailRef}
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="hint">At least 8 characters.</p>
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="button" disabled={busy !== null} onClick={() => void submit("signup")}>
            {busy === "signup" ? "Creating…" : "Create account"}
          </button>
          <button className="button secondary" type="submit" disabled={busy !== null}>
            {busy === "login" ? "Signing in…" : "Log in"}
          </button>
        </div>
      </form>
    </div>
  );
}
