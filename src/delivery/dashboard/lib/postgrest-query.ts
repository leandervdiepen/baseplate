import { coerce } from "./row-values.ts";

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "is_null"
  | "is_not_null";

export type FilterClause = {
  column: string;
  type: string;
  operator: FilterOperator;
  value: string;
};

export type SortRule = {
  column: string;
  direction: "asc" | "desc";
};

export const FILTER_LABELS: { id: FilterOperator; label: string }[] = [
  { id: "eq", label: "equals" },
  { id: "neq", label: "is not" },
  { id: "gt", label: "is greater than" },
  { id: "gte", label: "is at least" },
  { id: "lt", label: "is less than" },
  { id: "lte", label: "is at most" },
  { id: "contains", label: "contains" },
  { id: "is_null", label: "is empty" },
  { id: "is_not_null", label: "is not empty" },
];

export function needsValue(operator: FilterOperator): boolean {
  return operator !== "is_null" && operator !== "is_not_null";
}

export function describeFilter(clause: FilterClause): string {
  const label = FILTER_LABELS.find((entry) => entry.id === clause.operator)?.label ?? clause.operator;
  return needsValue(clause.operator)
    ? `${clause.column} ${label} ${clause.value}`
    : `${clause.column} ${label}`;
}

export type QueryShape = {
  filters: readonly FilterClause[];
  sort: SortRule | null;
  limit: number;
  offset: number;
};

/**
 * Turns what the operator asked for into a PostgREST query.
 *
 * Every clause becomes something the database answers. Nothing here filters,
 * sorts, or paginates in the browser, which is the same rule the client SDK
 * follows and the reason row access cannot be sidestepped by the studio.
 */
export function toQuery(shape: QueryShape): string {
  const params = new URLSearchParams();
  for (const clause of shape.filters) {
    params.append(clause.column, filterValue(clause));
  }
  if (shape.sort) {
    params.set("order", `${shape.sort.column}.${shape.sort.direction}`);
  }
  params.set("limit", String(shape.limit));
  if (shape.offset > 0) {
    params.set("offset", String(shape.offset));
  }
  return params.toString();
}

function filterValue(clause: FilterClause): string {
  if (clause.operator === "is_null") {
    return "is.null";
  }
  if (clause.operator === "is_not_null") {
    return "not.is.null";
  }
  if (clause.operator === "contains") {
    return `ilike.*${clause.value}*`;
  }
  const coerced = coerce(clause.value, clause.type);
  return `${clause.operator}.${typeof coerced === "object" ? clause.value : String(coerced)}`;
}

/**
 * PostgREST puts the count in Content-Range as `0-99/342`, and answers `*`
 * when it was not asked for one.
 */
export function totalFromRange(range: string | null): number | null {
  const total = range?.split("/")[1];
  if (!total || total === "*") {
    return null;
  }
  const parsed = Number(total);
  return Number.isInteger(parsed) ? parsed : null;
}
