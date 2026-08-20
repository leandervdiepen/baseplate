import { useEffect, useState } from "react";
import {
  createBucket,
  dropBucket,
  getBuckets,
  setBucketVisibility,
  type BucketList,
  type BucketSummary,
  type BucketVisibility,
} from "../lib/api/index.ts";

/**
 * The buckets in this project and the three things that can be done to them.
 * Every call answers with the whole list, so what is on screen is what the
 * operator just did rather than a guess kept in sync by hand.
 *
 * An action reports whether it worked, which is all the page needs to know to
 * clear the form that asked for it.
 */
export function useBuckets() {
  const [buckets, setBuckets] = useState<BucketSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBuckets()
      .then((list) => setBuckets(list.buckets))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to read your buckets.");
        setBuckets([]);
      });
  }, []);

  async function act(run: () => Promise<BucketList>, said: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setBuckets((await run()).buckets);
      setMessage(said);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    buckets,
    busy,
    message,
    error,

    create(name: string, visibility: BucketVisibility) {
      return act(() => createBucket(name, visibility), `Made '${name}'.`);
    },

    show(name: string, visibility: BucketVisibility) {
      return act(() => setBucketVisibility(name, visibility), `'${name}' is now ${visibility}.`);
    },

    drop(name: string) {
      return act(() => dropBucket(name), `Removed '${name}'.`);
    },

    /** A refusal that never left the browser, said in the same place as the rest. */
    refuse(reason: string) {
      setError(reason);
    },
  };
}
