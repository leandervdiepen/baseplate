import { useEffect, useState } from "react";
import {
  getHistory,
  getSchema,
  type SchemaHistoryEntry,
  type SchemaSnapshot,
} from "../lib/operator-client.ts";
import { PolicyCard } from "./policy-card.tsx";
import { SchemaHistory } from "./schema-history.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { IconPolicies } from "../primitives/icon.tsx";

export function PoliciesPage() {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [history, setHistory] = useState<SchemaHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSchema()
      .then(setSchema)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read the policies.");
      });
    void getHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  const tables = schema?.tables ?? [];

  return (
    <>
      <PageHeader
        title="Policies"
        description="Row-level security on your tables. One policy per table, applied by the stack itself, so a table cannot exist without it."
      />
      <StatusMessage message={error} tone="error" className="mb-4 block" />
      {schema && tables.length === 0 ? (
        <EmptyState
          icon={<IconPolicies width={20} height={20} />}
          title="No policies yet"
          description="Policies arrive with tables. Create a table on Schema and its row access comes with it."
        />
      ) : (
        <div className="max-w-[var(--container-content)] space-y-[var(--space-md)]">
          {tables.map((table) => (
            <PolicyCard key={table.name} table={table.name} ownerColumn={table.ownerColumn} />
          ))}
        </div>
      )}
      <SchemaHistory entries={history} />
    </>
  );
}
