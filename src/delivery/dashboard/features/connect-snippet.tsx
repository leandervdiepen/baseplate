import { Hint } from "../primitives/input.tsx";

const SNIPPET = `import { createClient } from "@diepen/baseplate/client";

const client = createClient("${"${API_URL}"}");
await client.auth.signUp({ email, password });

const { data } = await client
  .from("notes")
  .select()
  .eq("pinned", true)
  .order("title")
  .limit(20);`;

export function ConnectSnippet({ baseUrl }: { baseUrl: string | null }) {
  const snippet = SNIPPET.replace("${API_URL}", baseUrl ?? "http://127.0.0.1:8080");
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
      <h2 className="mb-2 text-[length:var(--text-lg)] font-semibold tracking-[var(--tracking-brand)] leading-[var(--leading-snug)]">
        Connect from code
      </h2>
      <Hint>
        No public key. Your app installs @diepen/baseplate and points the client at this URL.
        The session persists and refreshes itself.
      </Hint>
      <pre className="mt-3 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-[var(--space-md)] py-3.5 font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
        {snippet}
      </pre>
    </section>
  );
}
