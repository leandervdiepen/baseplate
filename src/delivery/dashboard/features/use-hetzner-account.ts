import { useCallback, useEffect, useState } from "react";
import { getHetznerAccount, type CloudAccountSnapshot } from "../lib/api/index.ts";

/**
 * What the operator's own Hetzner account holds, read by operator HTTP with the
 * tokens already saved on this machine. It turns three names that have to be
 * typed exactly into three lists to pick from, so a typo shows up here rather
 * than half way through a provision.
 *
 * Nothing is asked for until a token is stored: without one the answer is only
 * ever a refusal.
 */
export function useHetznerAccount(secrets: { hcloud: boolean; dnsToken: boolean }) {
  const [account, setAccount] = useState<CloudAccountSnapshot | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setAccount(await getHetznerAccount());
    } catch {
      setAccount(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (secrets.hcloud || secrets.dnsToken) {
      void check();
    }
    // Either token arriving is a reason to ask again: the second one is what
    // turns the zone list from a refusal into a list.
  }, [check, secrets.hcloud, secrets.dnsToken]);

  return { account, checking, check: () => void check() };
}
