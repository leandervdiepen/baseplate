import { useCallback, useState } from "react";
import { useCaller } from "../lib/caller.ts";
import { TableList } from "./table-list.tsx";
import { TablePanels, type Panel } from "./table-panels.tsx";
import { TableRows } from "./table-rows.tsx";
import { TableVisualizer } from "./table-visualizer.tsx";
import { useSchema } from "./use-schema.ts";
import { useTableRows } from "./use-table-rows.ts";
import { EmptyState } from "../patterns/empty-state.tsx";
import { PageHeader } from "../patterns/page-header.tsx";
import { StatusMessage } from "../patterns/status-message.tsx";
import { Button } from "../primitives/button.tsx";
import { Segmented } from "../primitives/segmented.tsx";

const VIEWS = [
  { id: "data", label: "Data" },
  { id: "schema", label: "Schema" },
] as const;

type View = (typeof VIEWS)[number]["id"];

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
  const [view, setView] = useState<View>("data");
  const [panel, setPanel] = useState<Panel>(null);

  /** Land on a table rather than on nothing, unless one was already chosen. */
  const openFirst = useCallback(
    (first: string | null) => {
      if (!selected) {
        onSelect(first);
      }
    },
    [selected, onSelect],
  );
  const { schema, tables, reload } = useSchema(openFirst);

  const table = tables.find((entry) => entry.name === selected);
  const columns = table?.columns ?? [];
  const primaryKey = columns.find((column) => column.primaryKey)?.name ?? null;

  const data = useTableRows({
    token: caller?.token,
    table: selected,
    primaryKey,
    enabled: apiUp && view === "data",
  });

  function choose(name: string): void {
    onSelect(name);
    data.reset();
  }

  function afterSchemaChange(statement: string): void {
    data.say(statement);
    setPanel(null);
    reload();
  }

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
        <TablePanels
          panel={panel}
          table={undefined}
          columns={[]}
          callerSub={null}
          busy={false}
          onClose={() => setPanel(null)}
          onInsert={() => undefined}
          onSchemaChange={afterSchemaChange}
        />
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

          <StatusMessage message={data.said} className="block" />
          <StatusMessage message={data.error} tone="error" className="block" />

          {view === "data" ? (
            <TableRows
              caller={caller}
              table={table}
              data={data}
              primaryKey={primaryKey}
              onNeedToken={onNeedToken}
              onPanel={setPanel}
            />
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

      <TablePanels
        panel={panel}
        table={table}
        columns={columns}
        callerSub={caller?.sub ?? null}
        busy={data.busy}
        onClose={() => setPanel(null)}
        onInsert={(values) => void data.insert(values).then(() => setPanel(null))}
        onSchemaChange={afterSchemaChange}
      />
    </>
  );
}
