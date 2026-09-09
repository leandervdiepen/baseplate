import { useCallback, useEffect, useState } from "react";
import { getHetznerAccount, type CloudAccountSnapshot } from "../lib/api/index.ts";

/**
 * What the operator's Hetzner account holds, read with the token already on
 * this machine. Three names that must be typed exactly become three lists, so a
 * typo shows up here rather than half way through a provision.
 */
export function useHetznerAccount(secrets: { hcloud: boolean }) {
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
    if (secrets.hcloud) {
      void check();
    }
  }, [check, secrets.hcloud]);

  return { account, checking, check: () => void check() };
}
