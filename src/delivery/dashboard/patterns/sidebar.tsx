import type { ComponentType, SVGProps } from "react";
import { cn } from "../lib/cn.ts";
import { portLabel } from "../lib/format.ts";
import type { NavId } from "./nav.ts";
import {
  IconAuth,
  IconLogs,
  IconPolicies,
  IconSchema,
  IconSettings,
  IconTables,
  LogoMark,
} from "../primitives/icon.tsx";

const NAV: { id: NavId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "tables", label: "Tables", Icon: IconTables },
  { id: "schema", label: "Schema", Icon: IconSchema },
  { id: "policies", label: "Policies", Icon: IconPolicies },
  { id: "auth", label: "Auth", Icon: IconAuth },
  { id: "logs", label: "Logs", Icon: IconLogs },
  { id: "settings", label: "Settings", Icon: IconSettings },
];

/**
 * Below the desktop breakpoint this collapses to an icon rail. The labels stay
 * in the DOM either way, so the rail is still readable to a screen reader.
 */
export function Sidebar({
  current,
  onNavigate,
  apiUp,
  target,
  baseUrl,
}: {
  current: NavId;
  onNavigate: (id: NavId) => void;
  apiUp: boolean;
  target: string;
  baseUrl: string | null;
}) {
  return (
    <div className="sticky top-0 flex h-screen w-[var(--size-rail)] shrink-0 flex-col justify-between overflow-y-auto border-e border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 pb-[var(--space-md)] pt-5 lg:w-[var(--size-sidebar)] lg:px-3">
      <div className="flex flex-col gap-[var(--space-lg)]">
        <div className="flex items-center gap-2.5 lg:px-[var(--space-sm)]">
          <LogoMark />
          <div className="sr-only text-[length:var(--text-brand)] font-semibold tracking-[var(--tracking-brand)] text-[var(--color-text)] lg:not-sr-only">
            Baseplate
          </div>
          <div className="sr-only font-mono text-[length:var(--text-2xs)] leading-[14px] text-[var(--color-text-muted)] lg:not-sr-only lg:ms-auto">
            studio
          </div>
        </div>
        <nav aria-label="Studio sections" className="flex flex-col gap-0.5">
          <div className="sr-only mb-1.5 px-2.5 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] leading-[var(--leading-chip)] text-[var(--color-text-muted)] lg:not-sr-only">
            Workspace
          </div>
          {NAV.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "nav-item flex min-h-[var(--size-nav)] items-center justify-center gap-2.5 rounded-[var(--radius-md)] text-start text-[length:var(--text-sm)] leading-[var(--leading-chip)] transition-[background-color,color,box-shadow] duration-[var(--duration-hover)] ease-[var(--ease-out)] lg:justify-start lg:px-2.5",
                  active
                    ? "bg-[var(--color-bg)] font-semibold text-[var(--color-text)] shadow-[var(--shadow-control)]"
                    : "font-medium text-[var(--color-text-muted)]",
                )}
              >
                <span className="flex w-[var(--size-icon-slot)] shrink-0 items-center justify-center">
                  <item.Icon width={16} height={16} />
                </span>
                <span className="sr-only lg:not-sr-only">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-[var(--color-border)] pt-3 lg:px-2.5">
        <div className="flex flex-col items-center gap-[var(--space-sm)] lg:flex-row">
          <span
            className={cn(
              "inline-block size-[var(--size-dot)] shrink-0 rounded-[var(--radius-pill)]",
              apiUp ? "bg-[var(--color-accent)]" : "bg-[var(--color-danger)]",
            )}
          />
          <span className="sr-only text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)] lg:not-sr-only">
            {target}
          </span>
          <span className="sr-only font-mono text-[length:var(--text-2xs)] leading-[14px] tabular-nums text-[var(--color-text-muted)] lg:not-sr-only lg:ms-auto">
            {portLabel(baseUrl)}
          </span>
          <span className="sr-only">{apiUp ? "API is up" : "API is down"}</span>
        </div>
        <p className="sr-only text-[length:var(--text-xs)] leading-[var(--leading-tight)] text-[var(--color-text-muted)] lg:not-sr-only">
          Keys stay in this project on this machine.
        </p>
      </div>
    </div>
  );
}
