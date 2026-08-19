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
  leaf,
  children,
}: {
  current: NavId;
  onNavigate: (id: NavId) => void;
  apiUp: boolean;
  target: string;
  baseUrl: string | null;
  leaf?: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar
        current={current}
        onNavigate={onNavigate}
        apiUp={apiUp}
        target={target}
        baseUrl={baseUrl}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar current={current} leaf={leaf} />
        <main
          id="main"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-auto px-[var(--space-md)] py-[var(--space-lg)] focus:outline-none lg:px-[var(--space-xl)]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
