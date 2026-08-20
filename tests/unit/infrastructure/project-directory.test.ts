import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { FileProjectDirectory } from "#infrastructure";

const made: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "baseplate-projects-"));
  made.push(dir);
  return dir;
}

function projectAt(dir: string, name: string): string {
  const root = resolve(dir, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, "baseplate.env"), "TARGET=local\n");
  return root;
}

afterEach(() => {
  for (const dir of made.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a project is remembered by path, and named by its directory", async () => {
  const dir = scratch();
  const directory = new FileProjectDirectory(resolve(dir, "projects.json"));
  const root = projectAt(dir, "kanban");

  await directory.remember(root);

  expect(await directory.list()).toEqual([
    { root, name: "kanban", lastOpenedAt: expect.any(String) },
  ]);
});

/** Opening one again moves it up rather than adding it twice. */
test("remembering the same project twice keeps one entry", async () => {
  const dir = scratch();
  const directory = new FileProjectDirectory(resolve(dir, "projects.json"));
  const a = projectAt(dir, "a");
  const b = projectAt(dir, "b");

  await directory.remember(a);
  await directory.remember(b);
  await directory.remember(a);

  expect((await directory.list()).map((project) => project.name)).toEqual(["a", "b"]);
});

/** A directory somebody deleted is not a project you can be offered. */
test("a project whose config is gone drops off the list", async () => {
  const dir = scratch();
  const directory = new FileProjectDirectory(resolve(dir, "projects.json"));
  const kept = projectAt(dir, "kept");
  const gone = projectAt(dir, "gone");

  await directory.remember(kept);
  await directory.remember(gone);
  rmSync(gone, { recursive: true, force: true });

  expect((await directory.list()).map((project) => project.name)).toEqual(["kept"]);
});

test("forgetting one leaves the others", async () => {
  const dir = scratch();
  const directory = new FileProjectDirectory(resolve(dir, "projects.json"));
  const a = projectAt(dir, "a");
  const b = projectAt(dir, "b");

  await directory.remember(a);
  await directory.remember(b);
  await directory.forget(a);

  expect((await directory.list()).map((project) => project.name)).toEqual(["b"]);
});

/** The file is a convenience. Nonsense in it costs one re-open, not a crash. */
test("a file somebody hand-edited into nonsense reads as no projects", async () => {
  const dir = scratch();
  const file = resolve(dir, "projects.json");
  writeFileSync(file, "not json at all");

  expect(await new FileProjectDirectory(file).list()).toEqual([]);
});

test("no file yet reads as no projects", async () => {
  const dir = scratch();
  expect(await new FileProjectDirectory(resolve(dir, "nothing.json")).list()).toEqual([]);
});
