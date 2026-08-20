import { homedir } from "node:os";
import { resolve } from "node:path";
import { FileProjectDirectory } from "#infrastructure";

/**
 * The projects this operator has opened, kept beside their own config rather
 * than inside any one of them: a project cannot be the authority on which other
 * projects exist. It holds paths and nothing else, so losing the file costs one
 * re-open and no data.
 */
export const projectDirectory = new FileProjectDirectory(
  process.env.BASEPLATE_PROJECTS_FILE ?? resolve(homedir(), ".baseplate/projects.json"),
);

/** Never worth failing a command over. A forgotten project is a nuisance, not a fault. */
export function rememberProject(root: string): void {
  void projectDirectory.remember(root).catch(() => undefined);
}
