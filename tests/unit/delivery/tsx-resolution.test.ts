import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");

/**
 * npm hoists, so `<package>/node_modules/tsx/dist/cli.mjs` is only true in this
 * checkout and a real install died with MODULE_NOT_FOUND. A hard-coded
 * node_modules path passes every test that runs from the repository, which is
 * why this one exists.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "dist") {
      return [];
    }
    const path = resolve(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

/** Comments may name the trap. Code may not walk into it. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("nothing addresses another package's install layout by path", () => {
  const offenders = [...sourceFiles(resolve(ROOT, "src")), ...sourceFiles(resolve(ROOT, "bin"))]
    .filter((path) => withoutComments(readFileSync(path, "utf8")).includes("node_modules/"))
    .map((path) => path.slice(ROOT.length + 1));
  expect(offenders).toEqual([]);
});

test("tsx is found by module id, wherever npm put it", () => {
  // Through the real entry, in its own process, because that is the thing that
  // has to work on an install and a bare import here would not prove it.
  const found = execFileSync(
    process.execPath,
    ["-e", "import('./bin/tsx-entry.js').then((m) => console.log(m.tsxCli()))"],
    { cwd: ROOT, encoding: "utf8" },
  ).trim();
  expect(statSync(found).isFile()).toBe(true);
});
