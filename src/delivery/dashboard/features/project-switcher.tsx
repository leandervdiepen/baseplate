import type { ProjectSummary } from "../lib/api/index.ts";
import { useProjects } from "./use-projects.ts";
import { Menu, MenuItem } from "../patterns/menu.tsx";
import { StatusDot } from "../primitives/status-dot.tsx";

/**
 * Which project the studio is serving, and the way to serve another. The Start
 * button on the project you land in still has to be pressed: switching moves
 * the studio, and never a stack.
 */
export function ProjectSwitcher({ name, path }: { name: string; path: string }) {
  const { current, others, error, open } = useProjects(path);

  return (
    <div className="lg:px-[var(--space-sm)]">
      <Menu
        label="Switch project"
        className="w-full"
        trigger={({ open }) => (
          <span
            title={path}
            className="flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-[var(--color-accent-subtle)]"
          >
            <StatusDot ok={current?.running ?? false} small tone="quiet" />
            <span className="sr-only lg:not-sr-only lg:flex lg:min-w-0 lg:flex-col">
              <span className="truncate font-mono text-[length:var(--text-xs)] leading-[var(--leading-chip)] text-[var(--color-accent-strong)]">
                {name}
              </span>
              <span className="truncate text-[length:var(--text-2xs)] leading-[var(--leading-chip)] text-[var(--color-text-muted)]">
                {others.length > 0
                  ? `${String(others.length)} other project${others.length === 1 ? "" : "s"}`
                  : "the only project here"}
              </span>
            </span>
            <Chevron open={open} />
          </span>
        )}
      >
        <Row project={current} name={name} path={path} onOpen={open} />
        {others.map((project) => (
          <Row key={project.root} project={project} onOpen={open} />
        ))}
        {others.length === 0 ? (
          <p className="px-2.5 py-2 text-[length:var(--text-xs)] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
            Run <code>baseplate init</code> in another directory and it appears here.
          </p>
        ) : null}
      </Menu>
      {error ? (
        <p role="alert" className="mt-1 text-[length:var(--text-xs)] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One project. Whether its stack is up matters more than when it was last
 * opened, because only one stack runs at a time and that is the one holding
 * the ports.
 */
function Row({
  project,
  name,
  path,
  onOpen,
}: {
  project: ProjectSummary | undefined;
  name?: string;
  path?: string;
  onOpen: (root: string) => Promise<void>;
}) {
  if (!project) {
    return name ? (
      <MenuItem selected onSelect={() => undefined}>
        <StatusDot ok small tone="quiet" />
        <span className="min-w-0 grow truncate font-mono">{name}</span>
        <span className="sr-only">, the project this studio is serving</span>
      </MenuItem>
    ) : null;
  }
  return (
    <MenuItem
      selected={project.current}
      onSelect={() => {
        if (!project.current) {
          void onOpen(project.root);
        }
      }}
    >
      <StatusDot ok={project.running} small tone="quiet" />
      <span className="min-w-0 grow" title={project.root}>
        <span className="block truncate font-mono">{project.name}</span>
        <span className="block truncate text-[length:var(--text-2xs)] text-[var(--color-text-muted)]">
          {path ?? project.root}
        </span>
      </span>
      <span className="sr-only">
        {project.running ? ", stack running" : ", stack stopped"}
        {project.current ? ", currently open" : ""}
      </span>
    </MenuItem>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
      className="ms-auto hidden shrink-0 text-[var(--color-text-muted)] transition-[rotate] duration-[var(--duration-hover)] ease-[var(--ease-out)] lg:block"
      style={{ rotate: open ? "180deg" : "0deg" }}
    >
      <path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
