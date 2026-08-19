import { formatFilter, type Filter, type FilterOperator, type FilterValue } from "./filters.ts";
import { request, type QueryResult, type RequestState } from "./request.ts";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type OrderOptions = {
  ascending?: boolean;
  nullsFirst?: boolean;
};

/**
 * Chainable and awaitable. Filters, order, and limit build a PostgREST query
 * string; awaiting the builder sends it. Nothing is filtered in the client.
 */
export class QueryBuilder<Row, Result> implements PromiseLike<QueryResult<Result>> {
  private readonly filters: Filter[] = [];
  private readonly orders: string[] = [];
  private readonly state: RequestState;
  private readonly table: string;
  private readonly method: Method;
  private readonly body: unknown;
  private readonly wantsRows: boolean;
  private columns = "*";
  private limitValue: number | undefined;
  private offsetValue: number | undefined;
  private singleRow = false;

  // Written out rather than as parameter properties: apps import this file as
  // TypeScript, and Node's type stripping does not support that syntax.
  constructor(
    state: RequestState,
    table: string,
    method: Method,
    body: unknown,
    wantsRows: boolean,
  ) {
    this.state = state;
    this.table = table;
    this.method = method;
    this.body = body;
    this.wantsRows = wantsRows;
  }

  select(columns = "*"): this {
    this.columns = columns;
    return this;
  }

  eq(column: keyof Row & string, value: FilterValue): this {
    return this.filter(column, "eq", value);
  }

  neq(column: keyof Row & string, value: FilterValue): this {
    return this.filter(column, "neq", value);
  }

  gt(column: keyof Row & string, value: FilterValue): this {
    return this.filter(column, "gt", value);
  }

  gte(column: keyof Row & string, value: FilterValue): this {
    return this.filter(column, "gte", value);
  }

  lt(column: keyof Row & string, value: FilterValue): this {
    return this.filter(column, "lt", value);
  }

  lte(column: keyof Row & string, value: FilterValue): this {
    return this.filter(column, "lte", value);
  }

  like(column: keyof Row & string, pattern: string): this {
    return this.filter(column, "like", pattern);
  }

  ilike(column: keyof Row & string, pattern: string): this {
    return this.filter(column, "ilike", pattern);
  }

  is(column: keyof Row & string, value: null | boolean): this {
    return this.filter(column, "is", value);
  }

  in(column: keyof Row & string, values: readonly FilterValue[]): this {
    this.filters.push({ column, operator: "in", value: values });
    return this;
  }

  order(column: keyof Row & string, options: OrderOptions = {}): this {
    const direction = options.ascending === false ? "desc" : "asc";
    const nulls =
      options.nullsFirst === undefined ? "" : options.nullsFirst ? ".nullsfirst" : ".nullslast";
    this.orders.push(`${column}.${direction}${nulls}`);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /** Exactly one row, or an error. Use `maybeSingle` when zero is allowed. */
  single(): QueryBuilder<Row, Result extends (infer R)[] ? R : Result> {
    this.singleRow = true;
    return this as unknown as QueryBuilder<Row, Result extends (infer R)[] ? R : Result>;
  }

  async maybeSingle(): Promise<QueryResult<(Result extends (infer R)[] ? R : Result) | null>> {
    this.limitValue = this.limitValue ?? 1;
    const result = await this.run<unknown[]>();
    if (result.error) {
      return { data: null, error: result.error, status: result.status };
    }
    const rows = result.data ?? [];
    const first = rows[0] ?? null;
    return {
      data: first as (Result extends (infer R)[] ? R : Result) | null,
      error: null,
      status: result.status,
    };
  }

  then<TResult1 = QueryResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run<Result>().then(onfulfilled, onrejected);
  }

  private filter(column: string, operator: FilterOperator, value: unknown): this {
    this.filters.push({ column, operator, value });
    return this;
  }

  private run<T>(): Promise<QueryResult<T>> {
    const params = new URLSearchParams();
    for (const filter of this.filters) {
      params.append(filter.column, formatFilter(filter));
    }
    if (this.columns !== "*") {
      params.set("select", this.columns);
    }
    if (this.orders.length > 0) {
      params.set("order", this.orders.join(","));
    }
    if (this.limitValue !== undefined) {
      params.set("limit", String(this.limitValue));
    }
    if (this.offsetValue !== undefined) {
      params.set("offset", String(this.offsetValue));
    }
    const query = params.toString();
    const headers: Record<string, string> = {};
    if (this.wantsRows) {
      headers.Prefer = "return=representation";
    }
    if (this.singleRow) {
      headers.Accept = "application/vnd.pgrst.object+json";
    }
    const init: RequestInit = { method: this.method, headers };
    if (this.body !== undefined) {
      init.body = JSON.stringify(this.body);
    }
    return request<T>(this.state, `/${this.table}${query ? `?${query}` : ""}`, init);
  }
}
