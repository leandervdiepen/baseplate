import { useEffect, useMemo, useState } from "react";
import { getLogs } from "../lib/api/index.ts";

export type LogLine = { service: string; message: string; error: boolean };

/** Compose numbers every replica. One of each is not worth the suffix. */
function serviceName(raw: string): string {
  return raw.replace(/-\d+$/, "");
}

function parseLogs(text: string): LogLine[] {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\S+)\s+\|\s?(.*)$/);
      const message = (match?.[2] ?? line).trimEnd();
      return {
        service: serviceName(match?.[1] ?? "compose"),
        message,
        error: /error|fatal|panic|timeout|failed|refused|reset by peer/i.test(message),
      };
    })
    // A service that printed a blank line said nothing. Giving it a row only
    // pushes the lines that do say something off the screen.
    .filter((line) => line.message.length > 0);
}

/**
 * What the stack has printed, as lines rather than as one block of text.
 * Docker hands over every service in one stream, so which service said what is
 * read back out of the prefix here and not by the page showing it.
 */
export function useLogs() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setText(await getLogs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read the logs from Docker.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const lines = useMemo(() => parseLogs(text), [text]);

  return { lines, busy, error, refresh: () => void refresh() };
}
