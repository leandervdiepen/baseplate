const SECOND = 1;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;

const UNITS: Record<string, number> = { s: SECOND, m: MINUTE, h: HOUR, d: DAY };

export const DEFAULT_ACCESS_TTL = "1h";
export const DEFAULT_REFRESH_TTL = "30d";

/**
 * Accepts `900`, `15m`, `12h`, `30d`. Returns seconds.
 * Written here rather than pulled in as a dependency because it is six lines.
 */
export function parseTtl(raw: string, fallback: string): number {
  const value = (raw || fallback).trim();
  const match = /^(\d+)\s*([smhd])?$/.exec(value);
  if (!match?.[1]) {
    throw new Error(`Could not read '${raw}' as a duration. Use 900, 15m, 12h, or 30d.`);
  }
  const seconds = Number(match[1]) * (UNITS[match[2] ?? "s"] ?? SECOND);
  if (seconds <= 0) {
    throw new Error("A token lifetime must be more than zero.");
  }
  return seconds;
}

export function formatTtl(seconds: number): string {
  if (seconds % DAY === 0) {
    return `${seconds / DAY}d`;
  }
  if (seconds % HOUR === 0) {
    return `${seconds / HOUR}h`;
  }
  if (seconds % MINUTE === 0) {
    return `${seconds / MINUTE}m`;
  }
  return `${seconds}s`;
}
