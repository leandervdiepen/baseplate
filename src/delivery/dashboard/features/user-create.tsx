import { useRef, useState } from "react";
import { createUser } from "../lib/api/index.ts";
import { Drawer } from "../patterns/drawer.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Field, Hint, Input } from "../primitives/input.tsx";
import { SecretField } from "../primitives/secret-field.tsx";

const MIN_PASSWORD = 8;

/**
 * Adding a user by hand, the way you would to try something out. It is the same
 * account an app would create through `client.auth.signUp`, so it can sign in
 * from anywhere the moment this closes.
 */
export function UserCreate({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  /** Checked on submit, never while typing: a form that argues as you type is rude. */
  function invalid(): boolean {
    const missing = email.trim().length === 0;
    setEmailError(missing ? "Enter the email address for this account." : null);
    setError(
      !missing && password.length < MIN_PASSWORD
        ? `The password needs at least ${String(MIN_PASSWORD)} characters.`
        : null,
    );
    if (missing) {
      emailRef.current?.focus();
    }
    return missing || password.length < MIN_PASSWORD;
  }

  async function submit(): Promise<void> {
    if (invalid()) {
      return;
    }
    const wanted = email.trim();
    setBusy(true);
    try {
      await createUser(wanted, password);
      onCreated(wanted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That user was not created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title="Add a user"
      description="They can sign in with this email and password straight away."
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-[var(--space-md)]"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Email" error={emailError}>
          <Input
            ref={emailRef}
            type="email"
            autoComplete="off"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <SecretField
          label="Password"
          value={password}
          onChange={setPassword}
          stored={false}
          hint={`At least ${String(MIN_PASSWORD)} characters.`}
        />
        <StatusMessage message={error} tone="error" />
        <div className="flex flex-wrap gap-[var(--space-sm)]">
          <Button type="submit" busy={busy}>
            Create user
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
        <Hint>
          Nobody is emailed about this. Hand them the password, or send a reset link from their
          panel instead.
        </Hint>
      </form>
    </Drawer>
  );
}
