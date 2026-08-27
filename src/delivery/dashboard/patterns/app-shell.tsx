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
  callerControl,
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
  callerControl?: ReactNode;
  children: ReactNode;
}) {
  return (
    /* A frame, not a long page: the sidebar and the top bar are chrome, and the
       content region is the only thing that scrolls. The breadcrumb and the
       caller pill used to scroll away, which on a studio whose whole subject is
       "whose rows am I looking at" is the wrong thing to lose. */
    <div className="flex h-dvh overflow-hidden">
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
        <TopBar current={current} leaf={leaf} {...(callerControl ? { callerControl } : {})} />
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
