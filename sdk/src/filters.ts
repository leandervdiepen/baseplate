export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in";

export type Filter = {
  readonly column: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
};

export type FilterValue = string | number | boolean | null;

/**
 * A scalar value is sent as-is; percent-encoding the query string is enough,
 * and PostgREST reads double quotes here as part of the literal.
 */
export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  return String(value);
}

/**
 * Inside `in.(a,b)` the comma is the separator, so a value carrying one has to
 * be quoted or it would read as two values.
 */
export function formatListItem(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  const text = String(value);
  return needsQuoting(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

export function formatFilter(filter: Filter): string {
  if (filter.operator === "in") {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    return `in.(${values.map(formatListItem).join(",")})`;
  }
  return `${filter.operator}.${formatScalar(filter.value)}`;
}

function needsQuoting(text: string): boolean {
  return text === "" || /[,()"\\]/.test(text) || text !== text.trim();
}
