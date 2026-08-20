export type SessionStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /**
   * Reports writes made somewhere else - another tab on the same origin. Only
   * storages that more than one runtime can see implement it.
   */
  onExternalChange?(listener: (raw: string | null) => void): () => void;
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
        onExternalChange: watchStorageEvent,
      };
    }
  } catch {
    // Private mode and server rendering both throw here. Fall through.
  }
  return memoryStorage();
}

/**
 * The browser fires `storage` in every tab but the one that wrote, so a listener
 * here only ever hears about somebody else. `key: null` is a `clear()`.
 */
function watchStorageEvent(listener: (raw: string | null) => void): () => void {
  const target = typeof window === "undefined" ? undefined : window;
  if (!target) {
    return () => undefined;
  }
  const handle = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SESSION_KEY) {
      return;
    }
    listener(event.key === null ? null : event.newValue);
  };
  target.addEventListener("storage", handle);
  return () => {
    target.removeEventListener("storage", handle);
  };
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
