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
  project,
  leaf,
  projectControl,
  children,
}: {
  current: NavId;
  onNavigate: (id: NavId) => void;
  apiUp: boolean;
  target: string;
  baseUrl: string | null;
  project: { name: string; path: string };
  leaf?: string | null | undefined;
  projectControl?: ReactNode;
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
        project={project}
        {...(projectControl ? { projectControl } : {})}
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
