import { useEffect, useState } from "react";
import { getProjects, openProject, type ProjectSummary } from "../lib/api/index.ts";

/**
 * Every project this machine knows about, and the way to point the studio at
 * another one.
 *
 * Opening one is a change of view and nothing else: it does not stop one stack
 * and start another, because those take minutes and should only ever happen
 * because somebody asked for them.
 */
export function useProjects(path: string) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getProjects()
      .then((list) => setProjects(list.projects))
      .catch(() => setProjects([]));
  }, [path]);

  return {
    current: projects.find((project) => project.current),
    others: projects.filter((project) => !project.current),
    error,

    async open(root: string): Promise<void> {
      try {
        await openProject(root);
        // Everything on screen belongs to the project that just changed: the
        // tables, the caller, the buckets. Re-reading the page is both the
        // simplest way to be right and the fastest to explain.
        window.location.reload();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not open that project.");
      }
    },
  };
}
