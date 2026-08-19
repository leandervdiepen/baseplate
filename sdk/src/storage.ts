export type SessionStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export const SESSION_KEY = "baseplate.session";

/**
 * localStorage in a browser, memory everywhere else, so the same client works
 * in a React app and in a script without the caller choosing.
 */
export function defaultStorage(): SessionStorage {
  try {
    const candidate = globalThis.localStorage;
    if (candidate) {
      candidate.getItem(SESSION_KEY);
      return {
        get: (key) => candidate.getItem(key),
        set: (key, value) => {
          candidate.setItem(key, value);
        },
        remove: (key) => {
          candidate.removeItem(key);
        },
      };
    }
  } catch {
    // Private mode and server rendering both throw here. Fall through.
  }
  return memoryStorage();
}

export function memoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}
