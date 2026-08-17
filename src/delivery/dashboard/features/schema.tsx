import { useEffect, useState } from "react";
import { getSchema, type SchemaSnapshot } from "../lib/operator-client.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { SchemaCanvas } from "../patterns/schema-canvas.tsx";
import { SchemaCard, SchemaRelations } from "../patterns/schema-card.tsx";
import { Button } from "../primitives/button.tsx";

export function SchemaPage({
  apiUp,
  onOpenRows,
  onProvision,
}: {
  apiUp: boolean;
  onOpenRows: () => void;
  onProvision: () => void;
}) {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSchema()
      .then(setSchema)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load schema.");
      });
  }, []);

  return (
    <>
      <PageHeader
        title="Schema"
        description={
          schema == null
            ? "Reading tables from the stack and the running API."
            : schema.live
              ? "Live columns from the running API. Owner columns are the RLS key."
              : "Declared tables from stack.json. Provision to see live columns."
        }
      />
      {error ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      {!apiUp && !schema?.live ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          API is down. Cards show the declared stack until you provision.
        </p>
      ) : null}
      {schema && schema.tables.length === 0 ? (
        <EmptyState
          title="No tables declared"
          description="A stack needs at least one table in stack/stack.json."
          action={
            <Button onClick={onProvision} disabled={apiUp}>
              Provision
            </Button>
          }
        />
      ) : null}
      {schema ? (
        <>
          <SchemaCanvas>
            <div className="flex flex-wrap gap-[var(--space-lg)]">
              {schema.tables.map((table) => (
                <SchemaCard
                  key={table.name}
                  name={table.name}
                  columns={table.columns}
                  onOpenRows={onOpenRows}
                />
              ))}
            </div>
          </SchemaCanvas>
          <SchemaRelations tables={schema.tables} />
        </>
      ) : null}
    </>
  );
}
