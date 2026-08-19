import { useEffect, useState } from "react";
import { getSchema } from "../lib/operator-client.ts";
import { ConnectSnippet } from "./connect-snippet.tsx";
import { MintPanel } from "./mint-panel.tsx";
import { UserLogin } from "./user-login.tsx";
import { PageHeader } from "../patterns/page-header.tsx";

export function AuthPage({ baseUrl }: { baseUrl: string | null }) {
  const [table, setTable] = useState("notes");

  useEffect(() => {
    void getSchema()
      .then((schema) => {
        const first = schema.tables[0]?.name;
        if (first) {
          setTable(first);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <PageHeader
        title="Auth"
        description="Users sign up with email and password. The API already trusts the JWT they get back, so there is no public key to hand out."
      />
      <div className="mb-[var(--space-lg)] grid items-start gap-[var(--space-lg)] lg:grid-cols-2">
        <UserLogin />
        <ConnectSnippet baseUrl={baseUrl} table={table} />
      </div>
      <MintPanel />
    </>
  );
}
