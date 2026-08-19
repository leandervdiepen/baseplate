import { useCallback, useEffect, useState } from "react";
import { getSchema, type SchemaSnapshot } from "../lib/operator-client.ts";
import { NewTableForm } from "./table-editor.tsx";
import { TableActions } from "./table-actions.tsx";
import { Callout } from "../patterns/callout.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { SchemaCanvas } from "../patterns/schema-canvas.tsx";
import { SchemaCard, SchemaRelations } from "../patterns/schema-card.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
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
        setError(cause instanceof Error ? cause.message : "Unable to read your tables.");
      });
  }, []);

  useEffect(refresh, [refresh]);

  function afterChange(statement: string): void {
    setNotice(statement);
    setCreating(false);
    refresh();
  }

  const tables = schema?.tables ?? [];
  const empty = schema !== null && tables.length === 0 && !creating;

  return (
    <>
      <PageHeader
        title="Schema"
        description={
          schema === null
            ? "Reading your tables from the database."
            : schema.live
              ? "Your tables, read from the database. The owner column is the row access key."
              : "The database is not reachable. Start the stack to see your tables."
        }
      />
      <Callout icon={<IconSchema />} className="mb-[var(--space-lg)]">
        These are your tables, in your database. A change applies immediately and is recorded
        there, so there is nothing to commit and nothing to keep in step.
      </Callout>
      <StatusMessage message={error} tone="error" className="mb-4 block" />
      {notice ? (
        <div
          role="status"
          className="mb-[var(--space-lg)] rounded-[var(--radius-md)] border border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)] px-4 py-3"
        >
          <p className="text-[length:var(--text-sm)] font-medium text-[var(--color-accent-strong)]">
            Applied to your database
          </p>
          <pre className="mt-1.5 overflow-x-auto font-mono text-[length:var(--text-xs)] leading-[var(--leading-token)]">
            <code>{notice}</code>
          </pre>
        </div>
      ) : null}

      {!empty ? (
        <div className="mb-[var(--space-lg)]">
          <Button onClick={() => setCreating(true)} disabled={creating || !apiUp}>
            <IconPlus />
            New table
          </Button>
        </div>
      ) : null}

      {creating ? (
        <div className="mb-[var(--space-lg)]">
          <NewTableForm onDone={afterChange} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          icon={<IconSchema width={20} height={20} />}
          title={apiUp ? "No tables yet" : "The stack is not running"}
          description={
            apiUp
              ? "Make your first one. It comes up with row access already on, so a caller only ever sees their own rows."
              : "Start the stack, then create your first table."
          }
          action={
            apiUp ? (
              <Button onClick={() => setCreating(true)}>Create a table</Button>
            ) : (
              <Button onClick={onProvision}>Start the stack</Button>
            )
          }
        />
      ) : null}

      {tables.length > 0 ? (
        <>
          <SchemaCanvas>
            <div className="flex flex-wrap gap-[var(--space-lg)]">
              {tables.map((table) => (
                <SchemaCard
                  key={table.name}
                  name={table.name}
                  columns={table.columns}
                  footer={
                    <TableActions
                      table={table.name}
                      onOpenRows={onOpenRows}
                      onChanged={afterChange}
                    />
                  }
                />
              ))}
            </div>
          </SchemaCanvas>
          <SchemaRelations tables={tables} />
        </>
      ) : null}
    </>
  );
}
