import { useCallback, useEffect, useState } from "react";
import { getHetznerAccount, type CloudAccountSnapshot } from "../lib/api/index.ts";

/**
 * What the operator's Hetzner account holds, read with the tokens already on
 * this machine. Three names that must be typed exactly become three lists, so a
 * typo shows up here rather than half way through a provision.
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
