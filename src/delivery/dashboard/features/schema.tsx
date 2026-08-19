import { useCallback, useEffect, useState } from "react";
import { getSchema, type SchemaSnapshot } from "../lib/operator-client.ts";
import { NewTableForm } from "./table-editor.tsx";
import { TableActions } from "./table-actions.tsx";
import { Callout } from "../patterns/callout.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { SchemaCanvas } from "../patterns/schema-canvas.tsx";
import { SchemaCard, SchemaRelations } from "../patterns/schema-card.tsx";
import { Button } from "../primitives/button.tsx";
import { IconPlus, IconSchema } from "../primitives/icon.tsx";

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
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    void getSchema()
      .then(setSchema)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load schema.");
      });
  }, []);

  useEffect(refresh, [refresh]);

  function afterChange(message: string): void {
    setNotice(message);
    setCreating(false);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Schema"
        description={
          schema == null
            ? "Reading your tables from the database."
            : schema.live
              ? "Your tables, read from the database. The owner column is the row access key."
              : "The database is not reachable. Provision the stack to see your tables."
        }
      />
      <Callout icon={<IconSchema />} className="mb-[var(--space-lg)]">
        These are your tables, in your database. Changes apply immediately and are recorded
        there, so there is nothing to commit and nothing to keep in step.
      </Callout>
      {error ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-accent-strong)]">
          {notice}
        </p>
      ) : null}
      <div className="mb-[var(--space-lg)] flex flex-wrap items-center gap-2.5">
        <Button onClick={() => setCreating(true)} disabled={creating || !apiUp}>
          <IconPlus />
          New table
        </Button>
      </div>

      {creating ? (
        <div className="mb-[var(--space-lg)]">
          <NewTableForm onDone={afterChange} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      {schema && schema.tables.length === 0 && !creating ? (
        <EmptyState
          title={apiUp ? "No tables yet" : "Stack is not running"}
          description={
            apiUp
              ? "Make your first one. It comes up with row access already on, so a caller only ever sees their own rows."
              : "Provision the stack, then create your first table."
          }
          action={
            apiUp ? (
              <Button onClick={() => setCreating(true)}>New table</Button>
            ) : (
              <Button onClick={onProvision}>Provision</Button>
            )
          }
        />
      ) : null}

      {schema ? (
        <>
          <SchemaCanvas>
            <div className="flex flex-wrap gap-[var(--space-lg)]">
              {schema.tables.map((table) => (
                <div
                  key={table.name}
                  className="overflow-clip rounded-[var(--radius-lg)] border border-[var(--color-border)]"
                >
                  <SchemaCard
                    name={table.name}
                    columns={table.columns}
                    onOpenRows={onOpenRows}
                  />
                  <TableActions
                    table={table.name}
                    columns={table.columns}
                    onChanged={afterChange}
                  />
                </div>
              ))}
            </div>
          </SchemaCanvas>
          <SchemaRelations tables={schema.tables} />
        </>
      ) : null}
    </>
  );
}
