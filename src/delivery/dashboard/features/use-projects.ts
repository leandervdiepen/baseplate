import { useEffect, useState } from "react";
import { getProjects, openProject, type ProjectSummary } from "../lib/api/index.ts";

/**
 * Every project this machine knows about. Opening one is a change of view and
 * nothing else: stopping one stack to start another takes minutes and only
 * happens because somebody asked.
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
