import type { ReactNode } from "react";
import { ACCESS_TONE } from "./access-choice.tsx";
import { CodeBlock } from "../patterns/code-block.tsx";
import { Card } from "../primitives/card.tsx";
import { StatusPill } from "../primitives/chip.tsx";
import type { TableAccess } from "../lib/api/types.ts";

/**
 * What a mode means, in the database's own words. Reads and writes are separate
 * sections because that is the only line the three modes move. `pending` is a
 * mode the operator has picked and not applied, so the SQL is what would run
 * rather than what is there - and it says so.
 */
export function PolicyCard({
  table,
  ownerColumn,
  access,
  pending,
}: {
  table: string;
  ownerColumn: string;
  access: TableAccess;
  pending?: boolean;
}) {
  const match = `${ownerColumn} = baseplate.caller_id()`;
  const owner = `CREATE POLICY ${table}_owner ON ${table}
  USING (${match})
  WITH CHECK (${match});`;
  const wider =
    access === "private"
      ? ""
      : `\n\nCREATE POLICY ${table}_read_all ON ${table} FOR SELECT
  USING (${access === "public" ? "true" : "baseplate.caller_id() IS NOT NULL"});`;

  return (
    <Card className="overflow-clip">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="font-mono text-[length:var(--text-sm)] font-medium">public.{table}</h2>
        <StatusPill tone={ACCESS_TONE[access]}>{access}</StatusPill>
        {pending ? <StatusPill>not applied</StatusPill> : null}
      </header>
      <div className="space-y-4 px-5 py-4">
        <Rule heading="Reads" operations="SELECT">
          {READS[access](ownerColumn)}
        </Rule>
        <Rule heading="Writes" operations="INSERT · UPDATE · DELETE">
          A caller changes a row only where <code>{ownerColumn}</code> matches the{" "}
          <code>sub</code> of their token. New rows are stamped with that sub on insert.
        </Rule>
        <section>
          <h3 className="mb-2 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
            {pending ? "What would run" : "In the database"}
          </h3>
          <CodeBlock>{`${owner}${wider}`}</CodeBlock>
        </section>
      </div>
    </Card>
  );
}

const READS: Record<TableAccess, (ownerColumn: string) => ReactNode> = {
  private: (ownerColumn) => (
    <>
      A caller sees only the rows where <code>{ownerColumn}</code> matches the <code>sub</code>{" "}
      of their token.
    </>
  ),
  shared: () => <>Any caller holding a token sees every row. Without one, none.</>,
  public: () => (
    <>Anyone sees every row, token or not. Treat everything in this table as published.</>
  ),
};

function Rule({
  heading,
  operations,
  children,
}: {
  heading: string;
  operations: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] text-[var(--color-text-muted)]">
        {heading}
      </h3>
      <p className="mt-2 text-[length:var(--text-sm)] leading-[var(--leading-snug)]">{children}</p>
      {/* Plain text, not chips: nothing here is clickable and it should not
          pretend otherwise. */}
      <p className="mt-1.5 font-mono text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        {operations}
      </p>
    </section>
  );
}
