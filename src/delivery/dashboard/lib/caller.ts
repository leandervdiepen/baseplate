import { useSyncExternalStore } from "react";

const KEY = "baseplate.caller";
const RECENTS_KEY = "baseplate.issued";

export type CallerSession = {
  sub: string;
  token: string;
  role?: string | undefined;
};

export type IssuedToken = CallerSession & { issuedAt: number };

/**
 * Who the studio is currently acting as. Kept in one place so every view
 * re-renders when a token is issued, rather than being remounted by hand.
 */
const listeners = new Set<() => void>();

let caller: CallerSession | undefined;
let issued: IssuedToken[] = [];
let loaded = false;

function load(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  caller = parse<CallerSession>(sessionStorage.getItem(KEY)) ?? undefined;
  issued = parse<IssuedToken[]>(sessionStorage.getItem(RECENTS_KEY)) ?? [];
}

function parse<T>(raw: string | null): T | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readCaller(): CallerSession | undefined {
  load();
  return caller;
}

function readIssued(): IssuedToken[] {
  load();
  return issued;
}

export function useCaller(): CallerSession | undefined {
  return useSyncExternalStore(subscribe, readCaller, () => undefined);
}

export function useIssued(): IssuedToken[] {
  return useSyncExternalStore(subscribe, readIssued, () => []);
}

export function loadCaller(): CallerSession | undefined {
  return readCaller();
}

/**
 * Stop being anybody. Impersonating is easy to start and was impossible to
 * end, which left an expired token in the tab with nothing saying so.
 */
export function clearCaller(): void {
  load();
  caller = undefined;
  issued = [];
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(RECENTS_KEY);
  for (const listener of listeners) {
    listener();
  }
}

export function saveCaller(session: CallerSession): void {
  load();
  caller = session;
  issued = [{ ...session, issuedAt: Date.now() }, ...issued.filter((item) => item.token !== session.token)].slice(0, 8);
  sessionStorage.setItem(KEY, JSON.stringify(caller));
  sessionStorage.setItem(RECENTS_KEY, JSON.stringify(issued));
  for (const listener of listeners) {
    listener();
  }
}
