import { expect, test } from "vitest";
import { ListProjects, type KnownProject, type RunningStack } from "#application";

function directoryOf(projects: KnownProject[]) {
  return {
    list: async () => projects,
    remember: async () => undefined,
    forget: async () => undefined,
  };
}

function stacksOf(stacks: RunningStack[]) {
  return { runningStacks: async () => stacks };
}

const KANBAN: KnownProject = {
  root: "/dev/kanban",
  name: "kanban",
  lastOpenedAt: "2026-08-01T00:00:00.000Z",
};
const NOTES: KnownProject = {
  root: "/dev/notes",
  name: "notes",
  lastOpenedAt: "2026-08-09T00:00:00.000Z",
};

test("a project whose stack is up is marked running, and says where", async () => {
  const list = await new ListProjects({
    directory: directoryOf([KANBAN, NOTES]),
    stacks: stacksOf([
      { projectName: "baseplate-kanban-1", projectRoot: "/dev/kanban", baseUrl: "http://127.0.0.1:8080" },
    ]),
  }).execute();

  expect(list.map((project) => [project.name, project.running, project.baseUrl])).toEqual([
    ["kanban", true, "http://127.0.0.1:8080"],
    ["notes", false, ""],
  ]);
});

/** Only one stack runs at a time, so the one that does is the one you want first. */
test("what is up comes first, then whatever was opened most recently", async () => {
  const list = await new ListProjects({
    directory: directoryOf([KANBAN, NOTES]),
    stacks: stacksOf([
      { projectName: "baseplate-kanban-1", projectRoot: "/dev/kanban", baseUrl: "" },
    ]),
  }).execute();

  expect(list.map((project) => project.name)).toEqual(["kanban", "notes"]);
});

test("with nothing running, the most recently opened leads", async () => {
  const list = await new ListProjects({
    directory: directoryOf([KANBAN, NOTES]),
    stacks: stacksOf([]),
  }).execute();

  expect(list.map((project) => project.name)).toEqual(["notes", "kanban"]);
});

/** Having started it is proof enough that it exists, whatever the list says. */
test("a running stack nobody recorded is still a project", async () => {
  const list = await new ListProjects({
    directory: directoryOf([]),
    stacks: stacksOf([
      { projectName: "baseplate-old-1", projectRoot: "/dev/forgotten", baseUrl: "" },
    ]),
  }).execute();

  expect(list).toEqual([
    {
      root: "/dev/forgotten",
      name: "forgotten",
      lastOpenedAt: "",
      running: true,
      baseUrl: "",
    },
  ]);
});

/** Docker being absent is not a reason to forget which projects exist. */
test("a machine with no Docker still lists the projects", async () => {
  const list = await new ListProjects({
    directory: directoryOf([KANBAN]),
    stacks: {
      runningStacks: () => Promise.reject(new Error("docker: command not found")),
    },
  }).execute();

  expect(list.map((project) => [project.name, project.running])).toEqual([["kanban", false]]);
});
