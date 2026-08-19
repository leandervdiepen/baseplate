import { useCallback, useEffect, useState } from "react";
import { useCaller } from "../lib/caller.ts";
import { shortId } from "../lib/format.ts";
import { dbFetch, getSchema, type SchemaColumn, type SchemaSnapshot } from "../lib/operator-client.ts";
import { RowForm } from "./row-form.tsx";
import { Callout } from "../patterns/callout.tsx";
import { DataCell, DataRow, DataTable } from "../patterns/data-table.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { MonoChip } from "../primitives/chip.tsx";
import { IconPolicies } from "../primitives/icon.tsx";
import { Segmented } from "../primitives/segmented.tsx";

type Row = Record<string, unknown>;

export function TablesPage({
  selected,
  onSelect,
  onNeedToken,
  onEditPolicy,
  onCreateTable,
  apiUp,
  onProvision,
}: {
  selected: string | null;
  onSelect: (name: string | null) => void;
  onNeedToken: () => void;
  onEditPolicy: () => void;
  onCreateTable: () => void;
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const caller = useCaller();
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSchema()
      .then((next) => {
        setSchema(next);
        if (!selected) {
          onSelect(next.tables[0]?.name ?? null);
        }
      })
      .catch(() => setSchema({ live: false, tables: [] }));
  }, [selected, onSelect]);

  const token = caller?.token;
  const refresh = useCallback(async () => {
    if (!token || !selected) {
      return;
    }
    const response = await dbFetch(token, `/${selected}`);
    if (response.status === 401) {
      setError("This token was rejected. Issue a new one on Auth.");
      return;
    }
    if (!response.ok) {
      setError(`Unable to load rows from ${selected}. The API answered ${response.status}.`);
      return;
    }
    setError(null);
    setRows((await response.json()) as Row[]);
  }, [token, selected]);

  useEffect(() => {
    if (apiUp) {
      void refresh();
    }
  }, [refresh, apiUp]);

  async function insert(values: Row): Promise<void> {
    if (!token || !selected) {
      return;
    }
    setBusy(true);
    try {
      const response = await dbFetch(token, `/${selected}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `That row was refused. The API answered ${response.status}.`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const table = schema?.tables.find((entry) => entry.name === selected);
  const columns = table?.columns ?? [];
  const tables = schema?.tables ?? [];

  if (!apiUp) {
    return (
      <>
        <PageHeader title="Tables" />
        <EmptyState
          title="The stack is not running"
          description="Rows come through the API, and the API is down. Start the stack to browse them."
          action={<Button onClick={() => void onProvision()}>Start the stack</Button>}
        />
      </>
    );
  }
  if (schema && tables.length === 0) {
    return (
      <>
        <PageHeader title="Tables" />
        <EmptyState
          title="No tables yet"
          description="A table holds your app's rows. Every one you make comes up with row access already on."
          action={<Button onClick={onCreateTable}>Create a table</Button>}
        />
      </>
    );
  }
  if (!caller) {
    return (
      <>
        <PageHeader title="Tables" />
        <EmptyState
          title="No caller yet"
          description="Rows are filtered by who is asking, so the studio needs a token before it can show you any."
          action={<Button onClick={onNeedToken}>Issue a token</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={selected ?? "Tables"}
        description={`public schema · ${rows.length} ${rows.length === 1 ? "row" : "rows"} visible to this caller`}
      />
      {tables.length > 1 ? (
        <div className="mb-[var(--space-md)]">
          <Segmented
            label="Table"
            value={selected ?? ""}
            onChange={(name) => {
              onSelect(name);
              setRows([]);
            }}
            options={tables.map((entry) => ({ id: entry.name, label: entry.name }))}
          />
        </div>
      ) : null}
      <Callout
        className="mb-[var(--space-lg)]"
        icon={<IconPolicies width={14} height={14} />}
        action={
          <Button variant="ghost" className="px-2" onClick={onEditPolicy}>
            See policy
          </Button>
        }
      >
        <span>Row security is on. This caller sees rows where </span>
        <MonoChip>{table?.ownerColumn ?? "owner_id"}</MonoChip>
        <span> matches their token.</span>
      </Callout>
      <div className="mb-[var(--space-lg)]">
        <RowForm columns={columns} busy={busy} onInsert={(values) => void insert(values)} />
      </div>
      <StatusMessage message={error} tone="error" className="mb-[var(--space-md)] block" />
      {rows.length === 0 ? (
        <EmptyState
          title="No rows yet"
          description={`Insert the first row into public.${selected ?? ""}. Each row stays visible only to the caller who owns it.`}
        />
      ) : (
        <DataTable
          caption={`Rows in public.${selected ?? ""} visible to this caller`}
          columns={columns.map((column) => ({
            key: column.name,
            label: column.name,
            ...(isId(column) ? { width: "var(--size-col-id)" } : {}),
          }))}
        >
          {rows.map((row, index) => (
            <DataRow key={String(row.id ?? index)}>
              {columns.map((column) =>
                isId(column) ? (
                  <DataCell key={column.name} width="var(--size-col-id)" mono muted={column.owner}>
                    {shortId(String(row[column.name] ?? ""))}
                  </DataCell>
                ) : (
                  <DataCell key={column.name}>
                    {display(row[column.name])}
                  </DataCell>
                ),
              )}
            </DataRow>
          ))}
        </DataTable>
      )}
    </>
  );
}

/** Identifier columns get a fixed, narrow column: they are shortened anyway. */
function isId(column: SchemaColumn): boolean {
  return column.primaryKey || column.owner;
}

function display(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
