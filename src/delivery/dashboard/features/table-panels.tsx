import type { SchemaColumn, SchemaTable } from "../lib/api/types.ts";
import { ConnectSnippet } from "./connect-snippet.tsx";
import { RlsPanel } from "./rls-panel.tsx";
import { RowForm } from "./row-form.tsx";
import { TableActions } from "./table-actions.tsx";
import { NewTableForm } from "./table-editor.tsx";
import type { Row } from "./use-table-rows.ts";
import { Drawer } from "../patterns/drawer.tsx";

export type Panel = "insert" | "new-table" | "edit-table" | "rls" | "api" | null;

/**
 * Everything the Tables page can open over itself. They are gathered here
 * because they share one rule: each is work on what is already on screen, so
 * the page stays behind rather than being replaced.
 */
export function TablePanels({
  panel,
  table,
  columns,
  callerSub,
  busy,
  onClose,
  onInsert,
  onSchemaChange,
}: {
  panel: Panel;
  table: SchemaTable | undefined;
  columns: SchemaColumn[];
  callerSub: string | null;
  busy: boolean;
  onClose: () => void;
  onInsert: (values: Row) => void;
  onSchemaChange: (statement: string) => void;
}) {
  if (panel === "new-table") {
    return (
      <Drawer title="New table" onClose={onClose}>
        <NewTableForm onDone={onSchemaChange} onCancel={onClose} />
      </Drawer>
    );
  }
  if (!table) {
    return null;
  }
  if (panel === "insert") {
    return (
      <Drawer
        title={`Insert a row into ${table.name}`}
        description="The id and the owner column are left out: the database fills them in from your token."
        onClose={onClose}
      >
        <RowForm columns={columns} busy={busy} onInsert={onInsert} />
      </Drawer>
    );
  }
  if (panel === "edit-table") {
    return (
      <Drawer title={`Edit ${table.name}`} onClose={onClose}>
        <TableActions table={table.name} onOpenRows={onClose} onChanged={onSchemaChange} />
      </Drawer>
    );
  }
  if (panel === "rls") {
    return (
      <Drawer title={`Row security on ${table.name}`} onClose={onClose}>
        <RlsPanel
          table={table.name}
          ownerColumn={table.ownerColumn}
          access={table.access}
          callerSub={callerSub}
          onChanged={onSchemaChange}
        />
      </Drawer>
    );
  }
  if (panel === "api") {
    return (
      <Drawer title={`Reach ${table.name} from code`} onClose={onClose}>
        <ConnectSnippet baseUrl={null} table={table.name} />
      </Drawer>
    );
  }
  return null;
}
