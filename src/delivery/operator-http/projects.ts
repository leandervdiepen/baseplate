import type { IncomingMessage, ServerResponse } from "node:http";
import { ListProjects, type ProjectSummary } from "#application";
import { runningStacks } from "#infrastructure";
import { projectDirectory as directory, rememberProject } from "../project-directory.ts";
import { switchProject } from "./current-project.ts";
import { readJsonBody, sendJson } from "./json.ts";

export async function listProjects(current: string, res: ServerResponse): Promise<void> {
  const projects = await new ListProjects({ directory, stacks: { runningStacks } }).execute();
  sendJson(res, 200, {
    current,
    projects: projects.map((project) => ({ ...project, current: project.root === current })),
  } satisfies { current: string; projects: (ProjectSummary & { current: boolean })[] });
}

/**
 * Switching is deliberately only a change of view. It does not stop one stack
 * and start another: those are minutes of work with real consequences, and the
 * Start button already says so.
 */
export async function openProject(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { root?: string };
  const root = typeof body.root === "string" ? body.root : "";
  switchProject(root);
  rememberProject(root);
  sendJson(res, 200, { root });
}

export async function dropProject(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { root?: string };
  if (typeof body.root === "string") {
    await directory.forget(body.root);
  }
  sendJson(res, 200, { ok: true });
}
