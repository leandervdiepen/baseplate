import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { backupKey, openFile, sealFile } from "../../../stack/shared/crypto.ts";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "baseplate-backup-"));
}

const KEY = backupKey(randomBytes(32).toString("base64url"));

test("a sealed backup opens again, byte for byte", async () => {
  const dir = scratch();
  const source = join(dir, "dump.bin");
  const original = randomBytes(300_000);
  writeFileSync(source, original);

  const sealed = await sealFile(KEY, source, join(dir, "dump.enc"));
  await openFile(KEY, join(dir, "dump.enc"), join(dir, "back.bin"));

  expect(readFileSync(join(dir, "back.bin")).equals(original)).toBe(true);
  expect(sealed.bytes).toBe(original.length + 12 + 16);
  expect(sealed.sha256).toMatch(/^[0-9a-f]{64}$/);
});

test("an empty database still seals and opens", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "empty.bin"), "");
  await sealFile(KEY, join(dir, "empty.bin"), join(dir, "empty.enc"));
  await openFile(KEY, join(dir, "empty.enc"), join(dir, "empty.back"));
  expect(readFileSync(join(dir, "empty.back")).length).toBe(0);
});

test("the sealed file is not the plain one", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "plain.bin"), "a very recognisable secret");
  await sealFile(KEY, join(dir, "plain.bin"), join(dir, "plain.enc"));
  expect(readFileSync(join(dir, "plain.enc")).toString("utf8")).not.toContain("recognisable");
});

/** A backup that was altered in the bucket must fail loudly, not restore. */
test("a tampered backup refuses to open", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "dump.bin"), randomBytes(4_096));
  await sealFile(KEY, join(dir, "dump.bin"), join(dir, "dump.enc"));

  const sealed = readFileSync(join(dir, "dump.enc"));
  sealed[100] = sealed[100] === undefined ? 0 : sealed[100] ^ 0xff;
  writeFileSync(join(dir, "dump.enc"), sealed);

  await expect(openFile(KEY, join(dir, "dump.enc"), join(dir, "back.bin"))).rejects.toThrow();
});

test("another key does not open it", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "dump.bin"), randomBytes(2_048));
  await sealFile(KEY, join(dir, "dump.bin"), join(dir, "dump.enc"));

  const other = backupKey(randomBytes(32).toString("base64url"));
  await expect(openFile(other, join(dir, "dump.enc"), join(dir, "back.bin"))).rejects.toThrow();
});

test("a truncated backup is refused rather than half restored", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "short.enc"), randomBytes(8));
  await expect(openFile(KEY, join(dir, "short.enc"), join(dir, "back.bin"))).rejects.toThrow(
    /too small/,
  );
});

test("a key is 32 bytes however the operator wrote it", () => {
  expect(backupKey(randomBytes(32).toString("base64url"))).toHaveLength(32);
  expect(backupKey("a passphrase someone typed by hand")).toHaveLength(32);
  expect(() => backupKey("short")).toThrow(/at least 16/);
});

test("two seals of the same file differ, because the nonce does", async () => {
  const dir = scratch();
  writeFileSync(join(dir, "same.bin"), "identical contents");
  const first = await sealFile(KEY, join(dir, "same.bin"), join(dir, "a.enc"));
  const second = await sealFile(KEY, join(dir, "same.bin"), join(dir, "b.enc"));
  expect(first.sha256).not.toBe(second.sha256);
});
