import { ConnectSnippet } from "./connect-snippet.tsx";
import { MintPanel } from "./mint-panel.tsx";
import { useExampleTable } from "./use-example-table.ts";
import { UserLogin } from "./user-login.tsx";
import { UsersPanel } from "./users.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { Section } from "../patterns/section.tsx";

/**
 * One view for everything auth: the accounts themselves first, then the ways
 * to become one of them from here - a real login, a connect snippet, a minted
 * token. Splitting these across two pages made people hunt for the other half.
 */
export function AuthPage({
  baseUrl,
  apiUp,
  onProvision,
}: {
  baseUrl: string | null;
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const table = useExampleTable("notes");

  return (
    <>
      <PageHeader
        title="Auth"
        description="Users sign up with email and password. The API trusts the JWT they get back, and row-level security decides what each of them sees."
      />
      <Section title="Users" className="pt-0">
        <UsersPanel apiUp={apiUp} onProvision={onProvision} />
      </Section>
      <Section
        title="Become a caller"
        description="Sign in as a user or mint a token for one, and Tables answers as that caller."
        divided={false}
      >
        <div className="grid items-start gap-[var(--space-lg)] lg:grid-cols-2">
          <UserLogin />
          <ConnectSnippet baseUrl={baseUrl} table={table} />
        </div>
        <MintPanel />
      </Section>
    </>
  );
}
