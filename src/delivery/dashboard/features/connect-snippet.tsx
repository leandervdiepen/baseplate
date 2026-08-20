import { CodeBlock } from "../patterns/code-block.tsx";
import { Card } from "../primitives/card.tsx";
import { Title } from "../primitives/heading.tsx";
import { Hint } from "../primitives/input.tsx";

function snippetFor(baseUrl: string, table: string): string {
  return `import { createClient } from "@diepen/baseplate/client";

const client = createClient("${baseUrl}");
const { error } = await client.auth.signUp({ email, password });

const { data } = await client
  .from("${table}")
  .select()
  .order("id")
  .limit(20);`;
}

export function ConnectSnippet({ baseUrl, table }: { baseUrl: string | null; table: string }) {
  return (
    <Card className="flex flex-col gap-[var(--space-md)] p-5">
      <Title>Connect from code</Title>
      <Hint>
        There is no public key. Your app installs <code>@diepen/baseplate</code>{" "}
        and points the client at this URL. The session persists and refreshes itself.
      </Hint>
      <CodeBlock>{snippetFor(baseUrl ?? "http://127.0.0.1:8080", table)}</CodeBlock>
    </Card>
  );
}
