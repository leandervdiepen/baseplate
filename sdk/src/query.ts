import { QueryBuilder } from "./builder.ts";
import type { TableInsert, TableName, TableRow, TableUpdate } from "./database.ts";
import type { RequestState } from "./request.ts";

export function createQuery<DB, T extends TableName<DB>>(
  state: RequestState,
  table: T,
) {
  type Row = TableRow<DB, T>;
  return {
    select(columns = "*"): QueryBuilder<Row, Row[]> {
      return new QueryBuilder<Row, Row[]>(state, table, "GET", undefined, false).select(
        columns,
      );
    },
    insert(row: TableInsert<DB, T> | TableInsert<DB, T>[]): QueryBuilder<Row, Row[]> {
      return new QueryBuilder<Row, Row[]>(state, table, "POST", row, true);
    },
    update(patch: TableUpdate<DB, T>): QueryBuilder<Row, Row[]> {
      return new QueryBuilder<Row, Row[]>(state, table, "PATCH", patch, true);
    },
    delete(): QueryBuilder<Row, Row[]> {
      return new QueryBuilder<Row, Row[]>(state, table, "DELETE", undefined, true);
    },
  };
}
