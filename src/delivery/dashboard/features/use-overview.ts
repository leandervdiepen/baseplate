import { useEffect, useState } from "react";
import { getOverview, type Overview } from "../lib/api/index.ts";

/**
 * The counts behind the Overview cards, read again whenever the stack comes up
 * or goes down: nothing in them means anything while the database is not
 * answering.
 */
export function useOverview(apiUp: boolean) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOverview()
      .then(setOverview)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read this project.");
      });
  }, [apiUp]);

  return { overview, error };
}
