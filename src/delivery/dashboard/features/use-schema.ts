import { useCallback, useEffect, useRef, useState } from "react";
import { getSchema, type SchemaSnapshot } from "../lib/api/index.ts";

/**
 * The shape of the operator's database: every table, its columns, and which
 * column decides who owns a row. It is read again after every change, because
 * the database is the record of what the schema is and this is only a view of
 * it.
 *
 * `onFirstLoad` is told the first table there is, once, so a page can open on
 * something rather than on nothing.
 */
export function useSchema(onFirstLoad: (first: string | null) => void) {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const first = useRef(true);

  const reload = useCallback(() => {
    void getSchema()
      .then((next) => {
        setSchema(next);
        if (first.current) {
          first.current = false;
          onFirstLoad(next.tables[0]?.name ?? null);
        }
      })
      .catch((cause: unknown) =>
        setSchema({
          live: false,
          tables: [],
          problem: {
            code: "operator.unreachable",
            message: cause instanceof Error ? cause.message : "Unable to read this project.",
          },
        }),
      );
  }, [onFirstLoad]);

  useEffect(reload, [reload]);

  return { schema, tables: schema?.tables ?? [], problem: schema?.problem ?? null, reload };
}
