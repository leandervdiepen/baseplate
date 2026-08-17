export function shortId(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 8)}…`;
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
