const KEY = "baseplate.caller";
const RECENTS_KEY = "baseplate.issued";

export type CallerSession = {
  sub: string;
  token: string;
  role?: string;
};

export type IssuedToken = CallerSession & { issuedAt: number };

export function loadCaller(): CallerSession | undefined {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as CallerSession;
}

export function saveCaller(session: CallerSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
  const recents = loadIssued().filter((item) => item.token !== session.token);
  recents.unshift({ ...session, issuedAt: Date.now() });
  sessionStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 8)));
}

export function loadIssued(): IssuedToken[] {
  const raw = sessionStorage.getItem(RECENTS_KEY);
  if (!raw) {
    return [];
  }
  return JSON.parse(raw) as IssuedToken[];
}
