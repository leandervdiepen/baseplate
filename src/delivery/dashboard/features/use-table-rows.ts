import { useCallback, useEffect, useState } from "react";
import { dbFetch, type SchemaColumn } from "../lib/api/index.ts";
import { toQuery, totalFromRange, type FilterClause } from "../lib/postgrest-query.ts";
import type { SortState } from "../patterns/data-grid.tsx";

export type Row = Record<string, unknown>;

const PAGE = 100;

/**
 * The rows of one table as a caller can see them, and the four things that can
 * be done to them. Every question here is one the database answers: the filters,
 * the sort, and the page are all part of the request, so nothing is narrowed
 * after the fact and the count means what it says.
 */
export function useTableRows({
  token,
  table,
  primaryKey,
  enabled,
}: {
  token: string | undefined;
  table: string | null;
  primaryKey: string | null;
  /** Off while the stack is down or another view is showing. */
  enabled: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !table) {
      return;
    }
    setBusy(true);
    try {
      const query = toQuery({ filters, sort, limit: PAGE, offset });
      const response = await dbFetch(token, `/${table}?${query}`, {
        headers: { Prefer: "count=exact" },
      });
      if (response.status === 401) {
        setError("This token was rejected. Issue a new one on Auth.");
        return;
      }
      if (!response.ok) {
        setError(await reason(response, `Unable to read ${table}.`));
        return;
      }
      setError(null);
      setRows((await response.json()) as Row[]);
      setTotal(totalFromRange(response.headers.get("content-range")));
    } finally {
      setBusy(false);
    }
  }, [token, table, filters, sort, offset]);

  useEffect(() => {
    if (enabled) {
      void refresh();
    }
  }, [refresh, enabled]);

  async function write(run: () => Promise<Response>, done: string, fallback: string): Promise<void> {
    setBusy(true);
    try {
      const response = await run();
      if (!response.ok) {
        setError(await reason(response, fallback));
        return;
      }
      setError(null);
      setSaid(done);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  /** A different table means a different set of columns, so nothing carries over. */
  function reset(): void {
    setRows([]);
    setTotal(null);
    setOffset(0);
    setFilters([]);
    setSort(null);
    setChosen(new Set());
    setError(null);
  }

  return {
    rows,
    total,
    offset,
    filters,
    sort,
    chosen,
    busy,
    error,
    said,
    limit: PAGE,
    setOffset,
    setChosen,
    reset,
    refresh: () => void refresh(),

    filterBy(next: FilterClause[]) {
      setFilters(next);
      setOffset(0);
    },

    /** Ascending, then descending, then no sorting at all. */
    sortBy(column: string) {
      setOffset(0);
      setSort((current) => {
        if (current?.column !== column) {
          return { column, direction: "asc" };
        }
        return current.direction === "asc" ? { column, direction: "desc" } : null;
      });
    },

    insert(values: Row) {
      return write(
        () =>
          dbFetch(token ?? "", `/${table ?? ""}`, {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(values),
          }),
        "Row inserted.",
        "That row was refused.",
      );
    },

    edit(row: Row, column: SchemaColumn, value: unknown) {
      if (!primaryKey) {
        return Promise.resolve();
      }
      return write(
        () =>
          dbFetch(token ?? "", `/${table ?? ""}?${primaryKey}=eq.${String(row[primaryKey])}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ [column.name]: value }),
          }),
        `Saved ${column.name}.`,
        `That change to ${column.name} was refused.`,
      );
    },

    removeChosen() {
      if (!primaryKey || chosen.size === 0) {
        return;
      }
      const ids = [...chosen].map((id) => `"${id}"`).join(",");
      void write(
        () =>
          dbFetch(token ?? "", `/${table ?? ""}?${primaryKey}=in.(${ids})`, { method: "DELETE" }),
        `${String(chosen.size)} ${chosen.size === 1 ? "row" : "rows"} deleted.`,
        "Those rows were not deleted.",
      ).then(() => setChosen(new Set()));
    },

    say(message: string) {
      setSaid(message);
    },
  };
}

/** The database's own words when it has them, since they say more than a status. */
async function reason(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `${fallback} The API answered ${String(response.status)}.`;
  } catch {
    return `${fallback} The API answered ${String(response.status)}.`;
  }
}
