import { useCallback, useEffect, useRef, useState } from "react";
import { useCaller } from "../lib/caller.ts";
import {
  dbFetch,
  getSchema,
  type SchemaColumn,
  type SchemaSnapshot,
} from "../lib/api/index.ts";
import { toQuery, totalFromRange, type FilterClause } from "../lib/postgrest-query.ts";
import { ConnectSnippet } from "./connect-snippet.tsx";
import { RlsPanel } from "./rls-panel.tsx";
import { RowForm } from "./row-form.tsx";
import { TableActions } from "./table-actions.tsx";
import { NewTableForm } from "./table-editor.tsx";
import { TableGrid, type Row } from "./table-grid.tsx";
import { TableList } from "./table-list.tsx";
import { TableToolbar } from "./table-toolbar.tsx";
import { TableVisualizer } from "./table-visualizer.tsx";
import { Drawer } from "../patterns/drawer.tsx";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import type { SortState } from "../patterns/data-grid.tsx";
import { Button } from "../primitives/button.tsx";
import { Segmented } from "../primitives/segmented.tsx";

const PAGE = 100;
const VIEWS = [
  { id: "data", label: "Data" },
  { id: "schema", label: "Schema" },
] as const;

type View = (typeof VIEWS)[number]["id"];
type Panel = "insert" | "new-table" | "edit-table" | "rls" | "api" | null;

/**
 * One page for everything about a table: the rows in it, the shape of it, and
 * the rule guarding it. Schema and Policies used to be separate destinations,
 * which meant leaving the data to answer a question about the data.
 */
export function TablesPage({
  selected,
  onSelect,
  onNeedToken,
  apiUp,
  onProvision,
}: {
  selected: string | null;
  onSelect: (name: string | null) => void;
  onNeedToken: () => void;
  apiUp: boolean;
  onProvision: () => Promise<void>;
}) {
  const caller = useCaller();
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [view, setView] = useState<View>("data");
  const [panel, setPanel] = useState<Panel>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const first = useRef(true);

  const loadSchema = useCallback(() => {
    void getSchema()
      .then((next) => {
        setSchema(next);
        if (first.current) {
          first.current = false;
          if (!selected) {
            onSelect(next.tables[0]?.name ?? null);
          }
        }
      })
      .catch(() => setSchema({ live: false, tables: [] }));
  }, [selected, onSelect]);

  useEffect(loadSchema, [loadSchema]);

  const table = schema?.tables.find((entry) => entry.name === selected);
  const columns = table?.columns ?? [];
  const primaryKey = columns.find((column) => column.primaryKey)?.name ?? null;
  const token = caller?.token;

  const refresh = useCallback(async () => {
    if (!token || !selected) {
      return;
    }
    setBusy(true);
    try {
      const query = toQuery({ filters, sort, limit: PAGE, offset });
      const response = await dbFetch(token, `/${selected}?${query}`, {
        headers: { Prefer: "count=exact" },
      });
      if (response.status === 401) {
        setError("This token was rejected. Issue a new one on Auth.");
        return;
      }
      if (!response.ok) {
        setError(await message(response, `Unable to read ${selected}.`));
        return;
      }
      setError(null);
      setRows((await response.json()) as Row[]);
      setTotal(totalFromRange(response.headers.get("content-range")));
    } finally {
      setBusy(false);
    }
  }, [token, selected, filters, sort, offset]);

  useEffect(() => {
    if (apiUp && view === "data") {
      void refresh();
    }
  }, [refresh, apiUp, view]);

  /** A different table means a different set of columns, so nothing carries over. */
  function choose(name: string): void {
    onSelect(name);
    setRows([]);
    setTotal(null);
    setOffset(0);
    setFilters([]);
    setSort(null);
    setChosen(new Set());
    setError(null);
  }

  async function write(
    run: () => Promise<Response>,
    saidWhat: string,
    fallback: string,
  ): Promise<void> {
    setBusy(true);
    try {
      const response = await run();
      if (!response.ok) {
        setError(await message(response, fallback));
        return;
      }
      setError(null);
      setSaid(saidWhat);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const insert = (values: Row) =>
    write(
      () =>
        dbFetch(token ?? "", `/${selected ?? ""}`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(values),
        }),
      "Row inserted.",
      "That row was refused.",
    ).then(() => setPanel(null));

  const edit = (row: Row, column: SchemaColumn, value: unknown) => {
    if (!primaryKey) {
      return Promise.resolve();
    }
    return write(
      () =>
        dbFetch(token ?? "", `/${selected ?? ""}?${primaryKey}=eq.${String(row[primaryKey])}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ [column.name]: value }),
        }),
      `Saved ${column.name}.`,
      `That change to ${column.name} was refused.`,
    );
  };

  const removeChosen = () => {
    if (!primaryKey || chosen.size === 0) {
      return;
    }
    const ids = [...chosen].map((id) => `"${id}"`).join(",");
    void write(
      () =>
        dbFetch(token ?? "", `/${selected ?? ""}?${primaryKey}=in.(${ids})`, { method: "DELETE" }),
      `${String(chosen.size)} ${chosen.size === 1 ? "row" : "rows"} deleted.`,
      "Those rows were not deleted.",
    ).then(() => setChosen(new Set()));
  };

  function afterSchemaChange(statement: string): void {
    setSaid(statement);
    setPanel(null);
    loadSchema();
  }

  const tables = schema?.tables ?? [];

  if (!apiUp) {
    return (
      <>
        <PageHeader title="Tables" />
        <EmptyState
          title="The stack is not running"
          description="Your tables live in the database, and it is not up. Start the stack to browse them."
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
          action={<Button onClick={() => setPanel("new-table")}>Create a table</Button>}
        />
        {panel === "new-table" ? (
          <Drawer title="New table" onClose={() => setPanel(null)}>
            <NewTableForm onDone={afterSchemaChange} onCancel={() => setPanel(null)} />
          </Drawer>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tables"
        description="Your tables, in your database. A change applies immediately and is recorded there."
      />

      <div className="flex flex-col gap-[var(--space-lg)] lg:flex-row">
        <TableList
          tables={tables}
          selected={selected}
          onSelect={choose}
          onNewTable={() => setPanel("new-table")}
        />

        <div className="min-w-0 grow space-y-[var(--space-md)]">
          <div className="flex flex-wrap items-center gap-[var(--space-md)]">
            <Segmented
              label="What to show"
              className="w-[200px]"
              value={view}
              options={[...VIEWS]}
              onChange={setView}
            />
            {view === "schema" ? (
              <Button variant="secondary" onClick={() => setPanel("new-table")}>
                New table
              </Button>
            ) : null}
          </div>

          <StatusMessage message={said} className="block" />
          <StatusMessage message={error} tone="error" className="block" />

          {view === "data" ? (
            !caller ? (
              <EmptyState
                title="No caller yet"
                description="Rows are filtered by who is asking, so the studio needs a token before it can show you any."
                action={<Button onClick={onNeedToken}>Issue a token</Button>}
              />
            ) : table ? (
              <>
                <TableToolbar
                  table={table.name}
                  ownerColumn={table.ownerColumn}
                  columns={columns}
                  filters={filters}
                  onFilters={(next) => {
                    setFilters(next);
                    setOffset(0);
                  }}
                  selectedCount={chosen.size}
                  onDelete={removeChosen}
                  onRefresh={() => void refresh()}
                  onInsert={() => setPanel("insert")}
                  onRls={() => setPanel("rls")}
                  onApi={() => setPanel("api")}
                  onEditTable={() => setPanel("edit-table")}
                  busy={busy}
                />
                <TableGrid
                  table={table.name}
                  columns={columns}
                  rows={rows}
                  primaryKey={primaryKey}
                  sort={sort}
                  onSort={(column) => {
                    setOffset(0);
                    setSort(nextSort(sort, column));
                  }}
                  selected={chosen}
                  onSelect={setChosen}
                  onEdit={edit}
                  total={total}
                  offset={offset}
                  limit={PAGE}
                  onPage={setOffset}
                  filtered={filters.length > 0}
                />
              </>
            ) : null
          ) : (
            <TableVisualizer
              tables={tables}
              selected={selected}
              onOpenRows={(name) => {
                choose(name);
                setView("data");
              }}
              onChanged={afterSchemaChange}
            />
          )}
        </div>
      </div>

      {panel === "new-table" ? (
        <Drawer title="New table" onClose={() => setPanel(null)}>
          <NewTableForm onDone={afterSchemaChange} onCancel={() => setPanel(null)} />
        </Drawer>
      ) : null}
      {panel === "insert" && table ? (
        <Drawer
          title={`Insert a row into ${table.name}`}
          description="The id and the owner column are left out: the database fills them in from your token."
          onClose={() => setPanel(null)}
        >
          <RowForm columns={columns} busy={busy} onInsert={(values) => void insert(values)} />
        </Drawer>
      ) : null}
      {panel === "edit-table" && table ? (
        <Drawer title={`Edit ${table.name}`} onClose={() => setPanel(null)}>
          <TableActions
            table={table.name}
            onOpenRows={() => setPanel(null)}
            onChanged={afterSchemaChange}
          />
        </Drawer>
      ) : null}
      {panel === "rls" && table ? (
        <Drawer title={`Row security on ${table.name}`} onClose={() => setPanel(null)}>
          <RlsPanel
            table={table.name}
            ownerColumn={table.ownerColumn}
            callerSub={caller?.sub ?? null}
          />
        </Drawer>
      ) : null}
      {panel === "api" && table ? (
        <Drawer title={`Reach ${table.name} from code`} onClose={() => setPanel(null)}>
          <ConnectSnippet baseUrl={null} table={table.name} />
        </Drawer>
      ) : null}
    </>
  );
}

/** Ascending, then descending, then no sorting at all. */
function nextSort(sort: SortState, column: string): SortState {
  if (sort?.column !== column) {
    return { column, direction: "asc" };
  }
  return sort.direction === "asc" ? { column, direction: "desc" } : null;
}

async function message(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; hint?: string };
    return body.message ?? `${fallback} The API answered ${String(response.status)}.`;
  } catch {
    return `${fallback} The API answered ${String(response.status)}.`;
  }
}
