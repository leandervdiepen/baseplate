import type { KnownProject, ProjectDirectory } from "../ports/project-directory.ts";
import type { RunningStack } from "../ports/stack-runtime.ts";

export type ProjectSummary = KnownProject & {
  /** This project's stack is the one holding the ports. Only one can be. */
  running: boolean;
  /** Where its API answers, when it is up. */
  baseUrl: string;
};

/**
 * Every project this operator has, and which is up. Docker is asked rather than
 * stored state, so a stack stopped from a terminal is not still shown running,
 * and a project only Docker knows about is added: it started, so it exists.
 */
export class ListProjects {
  constructor(
    private readonly deps: {
      directory: ProjectDirectory;
      /** Only the one capability is needed, so only the one is asked for. */
      stacks: { runningStacks(): Promise<readonly RunningStack[]> };
    },
  ) {}

  async execute(): Promise<readonly ProjectSummary[]> {
    const [known, running] = await Promise.all([
      this.deps.directory.list(),
      this.deps.stacks.runningStacks().catch(() => []),
    ]);
    const live = new Map(running.map((stack) => [stack.projectRoot, stack]));

    const summaries = known.map((project) => ({
      ...project,
      running: live.has(project.root),
      baseUrl: live.get(project.root)?.baseUrl ?? "",
    }));

    // A running stack whose directory was never recorded still belongs here.
    for (const stack of running) {
      if (!summaries.some((project) => project.root === stack.projectRoot)) {
        summaries.push({
          root: stack.projectRoot,
          name: nameOf(stack.projectRoot),
          lastOpenedAt: "",
          running: true,
          baseUrl: stack.baseUrl,
        });
      }
    }

    return summaries.sort(byRunningThenRecent);
  }
}

/** The directory is the project's name, so the operator named it themselves. */
function nameOf(root: string): string {
  return root.split(/[/\\]/).filter(Boolean).at(-1) ?? root;
}

/** What is up comes first; after that, whatever was opened most recently. */
function byRunningThenRecent(a: ProjectSummary, b: ProjectSummary): number {
  if (a.running !== b.running) {
    return a.running ? -1 : 1;
  }
  return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
}
