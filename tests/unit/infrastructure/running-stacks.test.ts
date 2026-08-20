import { expect, test } from "vitest";
import { parseRunningStacks } from "#infrastructure";

test("four containers of one stack are one running stack", () => {
  const output = [
    "baseplate-kanban-6666\t/Users/dev/kanban\t8090",
    "baseplate-kanban-6666\t/Users/dev/kanban\t8090",
    "baseplate-kanban-6666\t/Users/dev/kanban\t8090",
    "baseplate-kanban-6666\t/Users/dev/kanban\t8090",
  ].join("\n");

  expect(parseRunningStacks(output)).toEqual([
    {
      projectName: "baseplate-kanban-6666",
      projectRoot: "/Users/dev/kanban",
      baseUrl: "http://127.0.0.1:8090",
    },
  ]);
});

test("two projects stay two", () => {
  const output = [
    "baseplate-a-1\t/Users/dev/a\t8080",
    "baseplate-b-2\t/Users/dev/b\t8090",
  ].join("\n");

  expect(parseRunningStacks(output).map((stack) => stack.projectName)).toEqual([
    "baseplate-a-1",
    "baseplate-b-2",
  ]);
});

test("nothing running reads as nothing running", () => {
  expect(parseRunningStacks("")).toEqual([]);
});

/** A stack from an older version carries no labels, so it cannot be named. */
test("a line with no project root is not a stack we can point at", () => {
  expect(parseRunningStacks("baseplate-old-1\t\t8080")).toEqual([]);
});

test("a directory with a space in it survives the split", () => {
  expect(parseRunningStacks("baseplate-my-app-1\t/Users/dev/My Apps/api\t8080")).toEqual([
    {
      projectName: "baseplate-my-app-1",
      projectRoot: "/Users/dev/My Apps/api",
      baseUrl: "http://127.0.0.1:8080",
    },
  ]);
});
