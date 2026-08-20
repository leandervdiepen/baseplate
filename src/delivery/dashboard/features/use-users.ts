import { useCallback, useEffect, useState } from "react";
import { listUsers, type UserPage } from "../lib/api/index.ts";

const PAGE = 25;

/**
 * Everyone who can sign in to this project, one page at a time. The database
 * answers every search and every page, so what comes back is what the stack
 * actually holds rather than a list narrowed after the fact.
 */
export function useUsers(apiUp: boolean) {
  const [page, setPage] = useState<UserPage | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setPage(await listUsers({ search, limit: PAGE, offset }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read your users.");
      setPage({ live: false, total: 0, users: [] });
    } finally {
      setBusy(false);
    }
  }, [search, offset]);

  useEffect(() => {
    if (apiUp) {
      void load();
    }
  }, [apiUp, load]);

  return {
    page,
    searching: search.length > 0,
    offset,
    limit: PAGE,
    busy,
    said,
    error,
    setOffset,
    refresh: () => void load(),

    /** A new search starts at the top: page three of the old one means nothing. */
    searchFor(text: string) {
      setOffset(0);
      setSearch(text);
    },

    /**
     * A drawer finished something. Say so, then re-read the list: the panel
     * that did the work is already gone by then.
     */
    settled(message: string) {
      setError(null);
      setSaid(message);
      void load();
    },
  };
}
