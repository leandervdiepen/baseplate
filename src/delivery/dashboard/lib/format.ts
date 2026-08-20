export function shortId(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 8)}…`;
}

/** Sizes read at a glance, and stay the same width as they change. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : String(Math.round(value))} ${units[unit] ?? "TB"}`;
}

export function portLabel(baseUrl: string | null, fallback = "8080"): string {
  if (!baseUrl) {
    return `:${fallback}`;
  }
  try {
    const port = new URL(baseUrl).port;
    return `:${port || fallback}`;
  } catch {
    return `:${fallback}`;
  }
}
