import { useCallback, useEffect, useState } from "react";
import { loadCaller } from "../lib/caller.ts";
import { shortId } from "../lib/format.ts";
import { dbFetch, getSchema, type SchemaSnapshot } from "../lib/operator-client.ts";
import { RowForm } from "./row-form.tsx";
import { Callout } from "../patterns/callout.tsx";
import { DataCell, DataRow, DataTable } from "../patterns/data-table.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { Button } from "../primitives/button.tsx";
import { MonoChip } from "../primitives/chip.tsx";
import { IconPolicies } from "../primitives/icon.tsx";
import { Segmented } from "../primitives/segmented.tsx";

type Row = Record<string, unknown>;

export function TablesPage({
  onNeedToken,
  onEditPolicy,
  onCreateTable,
  apiUp,
  onProvision,
}: {
  onNeedToken: () => void;
  onEditPolicy: () => void;
  onCreateTable: () => void;
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const caller = loadCaller();
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSchema()
      .then((next) => {
        setSchema(next);
        setSelected((current) => current ?? next.tables[0]?.name ?? null);
      })
      .catch(() => setSchema({ live: false, tables: [] }));
  }, []);

  const token = caller?.token;
  const refresh = useCallback(async () => {
    if (!token || !selected) {
      return;
    }
    const response = await dbFetch(token, `/${selected}`);
    if (response.status === 401) {
      setError("Token rejected. Issue a new one on Auth.");
      return;
    }
    if (!response.ok) {
      setError(`Unable to load rows (${response.status}).`);
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

  if (!apiUp) {
    return (
      <EmptyState
        title="Stack is not running"
        description="Start it to browse rows through the API."
        action={<Button onClick={() => void onProvision()}>Provision</Button>}
      />
    );
  }
  if (schema && schema.tables.length === 0) {
    return (
      <EmptyState
        title="No tables yet"
        description="Make one first. It comes up with row access already on."
        action={<Button onClick={onCreateTable}>New table</Button>}
      />
    );
  }
  if (!caller) {
    return (
      <EmptyState
        title="No caller yet"
        description="Issue a token first, so row-level security has someone to be."
        action={<Button onClick={onNeedToken}>Issue token</Button>}
      />
    );
  }

  const table = schema?.tables.find((entry) => entry.name === selected);
  const columns = table?.columns ?? [];
  const count = rows.length;

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
        setError(body.message ?? `Insert failed (${response.status}).`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={selected ?? "Tables"}
        description={`public schema · ${count} ${count === 1 ? "row" : "rows"} visible to this caller`}
      />
      {(schema?.tables.length ?? 0) > 1 ? (
        <div className="mb-[var(--space-md)]">
          <Segmented
            value={selected ?? ""}
            onChange={(name) => {
              setSelected(name);
              setRows([]);
            }}
            options={(schema?.tables ?? []).map((entry) => ({
              id: entry.name,
              label: entry.name,
            }))}
          />
        </div>
      ) : null}
      <div className="mb-[var(--space-md)]">
        <RowForm columns={columns} busy={busy} onInsert={(values) => void insert(values)} />
      </div>
      <Callout
        className="mb-[var(--space-md)]"
        icon={<IconPolicies width={14} height={14} />}
        action={
          <button
            type="button"
            onClick={onEditPolicy}
            className="inline-flex min-h-10 items-center text-[length:var(--text-sm)] font-medium text-[var(--color-accent)]"
          >
            See policy
          </button>
        }
      >
        <span>Row security on. This caller sees rows where </span>
        <MonoChip>{table?.ownerColumn ?? "owner_id"}</MonoChip>
        <span> matches their token.</span>
      </Callout>
      {error ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          title="No rows yet"
          description={`Insert the first row into public.${selected ?? ""}. Each row is visible only to its owner.`}
        />
      ) : (
        <DataTable
          columns={columns.map((column) => ({
            key: column.name,
            label: column.name,
            ...(isId(column.name, columns) ? { width: "var(--size-col-id)" } : { grow: true }),
          }))}
        >
          {rows.map((row, index) => (
            <DataRow key={String(row.id ?? index)} last={index === rows.length - 1}>
              {columns.map((column) => {
                const value = row[column.name];
                return isId(column.name, columns) ? (
                  <DataCell key={column.name} width="var(--size-col-id)" mono muted={column.owner}>
                    {shortId(String(value ?? ""))}
                  </DataCell>
                ) : (
                  <DataCell key={column.name} grow>
                    {display(value)}
                  </DataCell>
                );
              })}
            </DataRow>
          ))}
        </DataTable>
      )}
    </>
  );
}

function isId(name: string, columns: { name: string; primaryKey: boolean; owner: boolean }[]): boolean {
  const column = columns.find((entry) => entry.name === name);
  return Boolean(column?.primaryKey || column?.owner);
}

function display(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
