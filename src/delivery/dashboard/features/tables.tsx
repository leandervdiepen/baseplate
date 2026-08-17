import { useEffect, useState } from "react";
import { loadCaller } from "../lib/caller.ts";
import { shortId } from "../lib/format.ts";
import { dbFetch, type ItemRow } from "../lib/operator-client.ts";
import { Callout } from "../patterns/callout.tsx";
import { DataCell, DataRow, DataTable } from "../patterns/data-table.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { Button } from "../primitives/button.tsx";
import { MonoChip } from "../primitives/chip.tsx";
import { IconPlus, IconPolicies } from "../primitives/icon.tsx";
import { Input } from "../primitives/input.tsx";

export function TablesPage({
  onNeedToken,
  onEditPolicy,
  apiUp,
  onProvision,
}: {
  onNeedToken: () => void;
  onEditPolicy: () => void;
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const caller = loadCaller();
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(token: string) {
    const response = await dbFetch(token, "/items");
    if (response.status === 401) {
      setError("Token rejected. Issue a new one on Auth.");
      return;
    }
    if (response.status === 503) {
      setError("API is down. Provision the stack.");
      return;
    }
    if (!response.ok) {
      setError(`Unable to load rows (${response.status}).`);
      return;
    }
    setRows((await response.json()) as ItemRow[]);
  }

  useEffect(() => {
    if (!caller || !apiUp) {
      return;
    }
    void refresh(caller.token);
  }, [caller?.token, apiUp]);

  if (!apiUp) {
    return (
      <EmptyState
        title="API is down"
        description="The local stack is not running. Provision it to browse rows through PostgREST."
        action={<Button onClick={() => void onProvision()}>Provision</Button>}
      />
    );
  }

  if (!caller) {
    return (
      <EmptyState
        title="No caller yet"
        description="Issue a token first so row-level security has a caller."
        action={<Button onClick={onNeedToken}>Issue token</Button>}
      />
    );
  }

  const token = caller.token;

  async function insertRow(nextBody = body) {
    setBusy(true);
    setError(null);
    try {
      const response = await dbFetch(token, "/items", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ body: nextBody }),
      });
      if (!response.ok) {
        setError(`Insert failed (${response.status}).`);
        return;
      }
      setBody("");
      await refresh(token);
    } finally {
      setBusy(false);
    }
  }

  const count = rows.length;

  return (
    <>
      <PageHeader
        title="items"
        description={`public schema · ${count} ${count === 1 ? "row" : "rows"} visible to this caller`}
      />
      <div className="mb-[var(--space-md)] flex min-h-[var(--size-control)] items-center gap-[var(--space-sm)]">
        <Input
          placeholder="Row body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="max-w-xs"
        />
        <Button onClick={() => void insertRow()} disabled={busy || !body}>
          <IconPlus />
          Insert row
        </Button>
        <span className="ms-auto text-[length:var(--text-sm)] tabular-nums text-[var(--color-text-muted)]">
          {count} {count === 1 ? "row" : "rows"}
        </span>
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
            Edit policy
          </button>
        }
      >
        <span>Row security on. This caller sees rows where </span>
        <MonoChip>owner_id</MonoChip>
        <span> matches their token.</span>
      </Callout>
      {error ? (
        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>
      ) : null}
      {error && rows.length === 0 ? null : rows.length === 0 ? (
        <EmptyState
          title="No rows yet"
          description="Insert the first row into public.items. Row security is on, so each row is visible only to its owner."
          action={
            <Button onClick={() => void insertRow("hello from baseplate")} disabled={busy}>
              <IconPlus />
              Insert row
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={[
            { key: "id", label: "id", width: "var(--size-col-id)" },
            { key: "owner", label: "owner_id", width: "var(--size-col-id)" },
            { key: "body", label: "body", grow: true },
          ]}
        >
          {rows.map((row, index) => (
            <DataRow key={row.id} last={index === rows.length - 1}>
              <DataCell width="var(--size-col-id)" mono>
                {shortId(row.id)}
              </DataCell>
              <DataCell width="var(--size-col-id)" mono muted>
                {shortId(row.owner_id)}
              </DataCell>
              <DataCell grow>{row.body}</DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}
    </>
  );
}
