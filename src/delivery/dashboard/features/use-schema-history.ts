import { useEffect, useState } from "react";
import { getHistory, type SchemaHistoryEntry, type SchemaSnapshot } from "../lib/api/index.ts";

/**
 * Every schema change this project has applied, as the database recorded it in
 * `baseplate.schema_history`. Read again whenever the schema itself changes,
 * since that is the only thing that adds to it.
 */
export function useSchemaHistory(tables: SchemaSnapshot["tables"]): SchemaHistoryEntry[] {
  const [entries, setEntries] = useState<SchemaHistoryEntry[]>([]);

  useEffect(() => {
    void getHistory()
      .then(setEntries)
      .catch(() => setEntries([]));
    // The tables are the trigger rather than an input: a change to them is the
    // only thing that writes a new line of history.
  }, [tables]);

  return entries;
}
