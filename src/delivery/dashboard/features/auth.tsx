import { ConnectSnippet } from "./connect-snippet.tsx";
import { MintPanel } from "./mint-panel.tsx";
import { UserLogin } from "./user-login.tsx";
import { PageHeader } from "../patterns/page-header.tsx";

export function AuthPage({
  onIssued,
  baseUrl,
}: {
  onIssued: () => void;
  baseUrl: string | null;
}) {
  return (
    <>
      <PageHeader
        title="Auth"
        description="Users sign up with email and password. The API already trusts the JWT. No public key."
      />
      <div className="mb-[var(--space-lg)] grid gap-[var(--space-lg)] md:grid-cols-2">
        <UserLogin onIssued={onIssued} />
        <ConnectSnippet baseUrl={baseUrl} />
      </div>
      <MintPanel onIssued={onIssued} />
    </>
  );
}
