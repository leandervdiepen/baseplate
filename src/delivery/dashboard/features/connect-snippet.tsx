import { Hint } from "../primitives/input.tsx";

const SNIPPET = `import { createClient, type Database } from "@baseplate/client";

const client = createClient<Database>("http://127.0.0.1:8080");
await client.auth.signUp({ email, password });
const { data } = await client.from("items").select();`;

export function ConnectSnippet() {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
      <h2 className="mb-2 text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]">
        Connect from code
      </h2>
      <Hint>
        No public key. Point the in-repo client at your API URL. Depend on it with file:../baseplate/sdk, not npm publish.
      </Hint>
      <pre className="mt-3 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
        {SNIPPET}
      </pre>
    </section>
  );
}
