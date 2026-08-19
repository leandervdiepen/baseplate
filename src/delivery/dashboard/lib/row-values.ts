export type ColumnShape = {
  name: string;
  type: string;
  primaryKey: boolean;
  owner: boolean;
};

/** Columns the database fills in. Offering them would only invite confusion. */
export function editableColumns<T extends ColumnShape>(columns: T[]): T[] {
  return columns.filter((column) => !column.primaryKey && !column.owner);
}

/**
 * A form gives strings. The column decides what the API should receive.
 * Anything that will not parse is sent as written, so the database gets to
 * explain what is wrong with it rather than the browser guessing.
 */
export function coerce(raw: string, type: string): unknown {
  if (type === "boolean") {
    return raw === "true" || raw === "t" || raw === "1" || raw === "yes";
  }
  if (["integer", "bigint", "numeric", "double precision", "real"].includes(type)) {
    const value = Number(raw);
    return Number.isNaN(value) ? raw : value;
  }
  if (type === "jsonb" || type === "json") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}
