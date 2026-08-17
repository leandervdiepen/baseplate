import type { ReactNode } from "react";
import { Sidebar } from "./sidebar.tsx";
import { TopBar } from "./top-bar.tsx";
import type { NavId } from "./nav.ts";

export type { NavId };

export function AppShell({
  current,
  onNavigate,
  apiUp,
  target,
  baseUrl,
  sessionAt,
  children,
}: {
  current: NavId;
  onNavigate: (id: NavId) => void;
  apiUp: boolean;
  target: string;
  baseUrl: string | null;
  sessionAt: number;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        current={current}
        onNavigate={onNavigate}
        apiUp={apiUp}
        target={target}
        baseUrl={baseUrl}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar key={sessionAt} current={current} />
        <main className="min-h-0 flex-1 overflow-auto px-[var(--space-xl)] py-[var(--space-lg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
