import { useEffect, useState } from "react";
import { getSchema } from "../lib/api/index.ts";

/**
 * A table name for the example code on Auth. Whatever this project already has
 * beats a placeholder: the snippet is meant to be copied and run, not read.
 */
export function useExampleTable(fallback: string): string {
  const [table, setTable] = useState(fallback);

  useEffect(() => {
    void getSchema()
      .then((schema) => {
        const first = schema.tables[0]?.name;
        if (first) {
          setTable(first);
        }
      })
      .catch(() => undefined);
  }, []);

  return table;
}
