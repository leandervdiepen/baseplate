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
    <aside className="flex h-screen w-[var(--size-sidebar)] shrink-0 flex-col justify-between border-e border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 pb-[var(--space-md)] pt-5">
      <div className="flex flex-col gap-[var(--space-lg)]">
        <div className="flex items-center gap-2.5 px-[var(--space-sm)]">
          <LogoMark />
          <div className="text-[length:var(--text-brand)] font-semibold tracking-[var(--tracking-brand)] text-[var(--color-text)]">
            Baseplate
          </div>
          <div className="ms-auto font-mono text-[length:var(--text-2xs)] leading-[14px] text-[var(--color-text-muted)]">
            studio
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          <div className="mb-1.5 px-2.5 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-caps)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
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
                  "nav-item flex min-h-[var(--size-nav)] items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-start text-[length:var(--text-sm)] leading-[var(--leading-chip)] transition-[background-color,color,border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                  active
                    ? "border border-[var(--color-border)] bg-[var(--color-bg)] font-semibold text-[var(--color-text)]"
                    : "font-medium text-[var(--color-text-muted)]",
                )}
              >
                <span className="flex w-[var(--size-icon-slot)] shrink-0 items-center justify-center">
                  <item.Icon width={16} height={16} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-[var(--color-border)] px-2.5 pt-3">
        <div className="flex items-center gap-[var(--space-sm)]">
          <span
            className={cn(
              "inline-block size-[var(--size-dot)] shrink-0 rounded-[var(--radius-pill)]",
              apiUp ? "bg-[var(--color-accent)]" : "bg-[var(--color-danger)]",
            )}
          />
          <span className="text-[length:var(--text-sm)] font-medium leading-[var(--leading-chip)]">
            {target}
          </span>
          <span className="ms-auto font-mono text-[length:var(--text-2xs)] leading-[14px] tabular-nums text-[var(--color-text-muted)]">
            {portLabel(baseUrl)}
          </span>
        </div>
        <p className="text-[length:var(--text-xs)] leading-[var(--leading-tight)] text-[var(--color-text-muted)]">
          Keys stay in this project on this machine.
        </p>
      </div>
    </aside>
  );
}
