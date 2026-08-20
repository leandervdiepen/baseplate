import type { SchemaSnapshot } from "./api/types.ts";

export type LaidOutTable = {
  name: string;
  /** Which column of the canvas the card sits in, left to right. */
  depth: number;
};

export type Edge = {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
};

/**
 * A table sits one column to the right of whatever it points at, so a foreign
 * key is always drawn left to right and never doubles back. Cycles stop at the
 * first repeat rather than looping forever.
 */
export function layoutTables(tables: SchemaSnapshot["tables"]): LaidOutTable[] {
  const byName = new Map(tables.map((table) => [table.name, table]));
  const depths = new Map<string, number>();

  const depthOf = (name: string, seen: Set<string>): number => {
    const known = depths.get(name);
    if (known !== undefined) {
      return known;
    }
    if (seen.has(name)) {
      return 0;
    }
    seen.add(name);
    const table = byName.get(name);
    const parents = (table?.columns ?? [])
      .map((column) => column.references?.table)
      .filter(
        (parent): parent is string =>
          parent !== undefined && parent !== name && byName.has(parent),
      );
    const depth =
      parents.length === 0 ? 0 : Math.max(...parents.map((parent) => depthOf(parent, seen))) + 1;
    depths.set(name, depth);
    return depth;
  };

  return tables.map((table) => ({ name: table.name, depth: depthOf(table.name, new Set()) }));
}

export function edgesBetween(tables: SchemaSnapshot["tables"]): Edge[] {
  const names = new Set(tables.map((table) => table.name));
  return tables.flatMap((table) =>
    table.columns
      .filter((column) => column.references && names.has(column.references.table))
      .map((column) => ({
        from: table.name,
        fromColumn: column.name,
        // The filter above proved these exist; TypeScript cannot see through it.
        to: column.references?.table ?? "",
        toColumn: column.references?.column ?? "",
      })),
  );
}

/** Cards grouped into the columns they are drawn in, in a stable order. */
export function columnsOfCards(layout: readonly LaidOutTable[]): string[][] {
  const deepest = layout.reduce((max, entry) => Math.max(max, entry.depth), 0);
  const columns: string[][] = [];
  for (let depth = 0; depth <= deepest; depth += 1) {
    columns.push(layout.filter((entry) => entry.depth === depth).map((entry) => entry.name));
  }
  return columns.filter((column) => column.length > 0);
}
