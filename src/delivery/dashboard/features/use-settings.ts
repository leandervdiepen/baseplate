import { useEffect, useState } from "react";
import {
  getConfig,
  OperatorError,
  provision,
  saveConfig,
  teardown,
} from "../lib/api/index.ts";
import type { ConfigDraft } from "./config-field.tsx";

type Job = "save" | "provision" | "teardown";

/**
 * What is in `baseplate.env`, and the four commands the Settings page can send
 * about it. One job runs at a time and says so, because saving a file, starting
 * a stack, and destroying a volume are not things to have in flight together.
 *
 * A command reports whether it worked, which is all the page needs to close the
 * question that asked for it.
 */
export function useSettings(onChanged: () => void) {
  /** Everything else in baseplate.env, so none of it needs the file opened. */
  const [config, setConfig] = useState<ConfigDraft>({});
  const [storedSecrets, setStoredSecrets] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Job | null>(null);
  /** Set when another project holds the ports, so we can offer to take them. */
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getConfig()
      .then((snapshot) => {
        setConfig(snapshot.values);
        setStoredSecrets(snapshot.secrets);
      })
      .catch(() => undefined);
  }, []);

  async function act(kind: Job, run: () => Promise<void>): Promise<boolean> {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      await run();
      onChanged();
      return true;
    } catch (cause) {
      if (cause instanceof OperatorError && cause.code === "stack.another_running") {
        setBlockedBy(cause.message);
      }
      setError(cause instanceof Error ? cause.message : "That did not work.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return {
    config,
    storedSecrets,
    busy,
    blockedBy,
    message,
    error,

    change(name: string, value: string) {
      setConfig((current) => ({ ...current, [name]: value }));
    },

    /** The page's own fields, written over whatever else the file already holds. */
    save(updates: ConfigDraft) {
      return act("save", async () => {
        await saveConfig({ ...config, ...updates });
        setMessage("Saved to baseplate.env in this project. Start the stack to apply it.");
      });
    },

    /** `replace` stops whichever other project is holding the ports. */
    start(replace = false) {
      return act("provision", async () => {
        setBlockedBy(null);
        const result = await provision(replace);
        setMessage(`Stack up at ${result.baseUrl}`);
      });
    },

    stop() {
      return act("teardown", async () => {
        await teardown(false);
        setMessage("Stopped. Your data is still here; start the stack to bring it back.");
      });
    },

    destroy() {
      return act("teardown", async () => {
        await teardown(true);
        setMessage("Destroyed: containers, volumes, and any server.");
      });
    },
  };
}
