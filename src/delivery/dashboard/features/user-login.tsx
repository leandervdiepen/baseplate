import { useRef, useState } from "react";
import { saveCaller } from "../lib/caller.ts";
import { peekJwt } from "../lib/jwt.ts";
import { signIn, signUp } from "../lib/operator-client.ts";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Card, CardTitle } from "../primitives/card.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";

type Kind = "signup" | "login";

export function UserLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Kind | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Checked on submit, never before: a form that argues while you type is rude. */
  function invalid(): boolean {
    const noEmail = email.trim().length === 0;
    const noPassword = password.length === 0;
    setEmailError(noEmail ? "Enter the email address for this account." : null);
    setPasswordError(noPassword ? "Enter the password for this account." : null);
    if (noEmail) {
      emailRef.current?.focus();
    } else if (noPassword) {
      passwordRef.current?.focus();
    }
    return noEmail || noPassword;
  }

  async function submit(kind: Kind): Promise<void> {
    setError(null);
    if (invalid()) {
      return;
    }
    setBusy(kind);
    try {
      const session = kind === "signup" ? await signUp(email, password) : await signIn(email, password);
      saveCaller({ sub: session.user.id, token: session.token, role: peekJwt(session.token).role });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Check the email and password.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <form
        className="flex flex-col gap-[var(--space-md)]"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("login");
        }}
      >
        <CardTitle>Sign up or log in</CardTitle>
        <Field label="Email" error={emailError}>
          <Input
            ref={emailRef}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 8 characters." error={passwordError}>
          <Input
            ref={passwordRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <StatusMessage message={error} tone="error" />
        <div className="flex flex-wrap gap-[var(--space-sm)]">
          <Button onClick={() => void submit("signup")} busy={busy === "signup"}>
            Create account
          </Button>
          <Button type="submit" variant="secondary" busy={busy === "login"}>
            Log in
          </Button>
        </div>
        <Hint>
          This signs in against the stack at <code className="font-mono">/auth</code>, not against
          operator mint. The JWT <code className="font-mono">sub</code> is the user id.
        </Hint>
      </form>
    </Card>
  );
}
