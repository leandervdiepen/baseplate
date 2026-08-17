import { useState } from "react";
import { saveCaller } from "../lib/caller.ts";
import { peekJwt } from "../lib/jwt.ts";
import { signIn, signUp } from "../lib/operator-client.ts";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

export function UserLogin({ onIssued }: { onIssued: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(kind: "signup" | "login") {
    setBusy(true);
    setError(null);
    try {
      const session = kind === "signup"
        ? await signUp(email, password)
        : await signIn(email, password);
      const claims = peekJwt(session.token);
      saveCaller({
        sub: session.user.id,
        token: session.token,
        role: claims.role,
      });
      onIssued();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-[var(--space-md)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
      <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]">
        Sign up or log in
      </h2>
      <Field label="Email">
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Password" hint="At least 8 characters. JWT_SECRET never leaves the server.">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      {error ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-[var(--space-sm)]">
        <Button onClick={() => void submit("signup")} disabled={busy || !email || !password}>
          {busy ? "Signing…" : "Create account"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void submit("login")}
          disabled={busy || !email || !password}
        >
          Log in
        </Button>
      </div>
      <Hint>This hits the stack at /auth, not operator mint. The JWT sub is the user id.</Hint>
    </section>
  );
}
