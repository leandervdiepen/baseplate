import { get, post, send } from "./http.ts";
import type { ProjectList } from "./types.ts";

export const getProjects = (): Promise<ProjectList> => get<ProjectList>("/api/projects");

/** Points the studio at another project. It does not start or stop a stack. */
export const openProject = (root: string): Promise<{ root: string }> =>
  post<{ root: string }>("/api/project", { root });

export const forgetProject = (root: string): Promise<void> =>
  send<void>("DELETE", "/api/project", { root });
