import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { syncTerraformDir } from "#infrastructure";

function dirs(): { source: string; work: string } {
  const base = mkdtempSync(resolve(tmpdir(), "baseplate-tf-"));
  const source = resolve(base, "package-infra");
  const work = resolve(base, "project/.baseplate/infra");
  mkdirSync(source, { recursive: true });
  writeFileSync(resolve(source, "main.tf"), "# version 1\n");
  writeFileSync(resolve(source, "cloud-init.yaml"), "#cloud-config\n");
  return { source, work };
}

test("the shipped configuration lands in the project, not beside the package", () => {
  const { source, work } = dirs();
  syncTerraformDir(source, work);
  expect(readFileSync(resolve(work, "main.tf"), "utf8")).toBe("# version 1\n");
  expect(readFileSync(resolve(work, "cloud-init.yaml"), "utf8")).toBe("#cloud-config\n");
});

test("an upgrade replaces the configuration and keeps the state", () => {
  const { source, work } = dirs();
  syncTerraformDir(source, work);
  writeFileSync(resolve(work, "terraform.tfstate"), '{"serial":7}');
  mkdirSync(resolve(work, ".terraform"), { recursive: true });
  writeFileSync(resolve(work, ".terraform", "provider"), "binary");

  writeFileSync(resolve(source, "main.tf"), "# version 2\n");
  syncTerraformDir(source, work);

  expect(readFileSync(resolve(work, "main.tf"), "utf8")).toBe("# version 2\n");
  expect(readFileSync(resolve(work, "terraform.tfstate"), "utf8")).toBe('{"serial":7}');
  expect(readFileSync(resolve(work, ".terraform", "provider"), "utf8")).toBe("binary");
});
