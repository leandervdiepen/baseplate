import { expect, test } from "vitest";
import { createBucket, isBucketVisibility, parseObjectKey } from "#domain";

test("a bucket is private unless it is asked to be otherwise", () => {
  expect(createBucket("avatars")).toEqual({ name: "avatars", visibility: "private" });
  expect(createBucket("avatars", "public").visibility).toBe("public");
});

test("a bucket name is checked before it reaches the database", () => {
  for (const name of ["Avatars", "my bucket", "1st", "-lead", "über", "", "a/b"]) {
    expect(() => createBucket(name), name).toThrow(/lowercase letters, digits, and dashes/);
  }
  expect(createBucket("my-files-2").name).toBe("my-files-2");
});

test("only the two visibilities exist", () => {
  expect(isBucketVisibility("private")).toBe(true);
  expect(isBucketVisibility("public")).toBe(true);
  expect(isBucketVisibility("world-readable")).toBe(false);
});

test("a key keeps the shape an app expects", () => {
  expect(parseObjectKey("me.png")).toBe("me.png");
  expect(parseObjectKey("cards/42/attachment.pdf")).toBe("cards/42/attachment.pdf");
  expect(parseObjectKey("  spaced.png  ")).toBe("spaced.png");
});

/** The bucket is a prefix in the blob store, so `..` would reach into another. */
test("a key cannot climb out of its bucket", () => {
  for (const key of ["../other/secret.png", "a/../../b", "./x", "a/./b"]) {
    expect(() => parseObjectKey(key), key).toThrow(/'\.' or '\.\.'/);
  }
});

test("a key cannot be empty, or pretend to be a path", () => {
  expect(() => parseObjectKey("")).toThrow(/needs a key/);
  expect(() => parseObjectKey("   ")).toThrow(/needs a key/);
  expect(() => parseObjectKey("/leading")).toThrow(/slash/);
  expect(() => parseObjectKey("trailing/")).toThrow(/slash/);
  expect(() => parseObjectKey("double//slash")).toThrow(/slash/);
});

test("a key cannot smuggle control characters into a header or a log", () => {
  expect(() => parseObjectKey("ok\nInjected: yes")).toThrow(/control characters/);
  expect(() => parseObjectKey("null\u0000byte")).toThrow(/control characters/);
});

test("a key has a limit, so a row cannot be made of one", () => {
  expect(() => parseObjectKey("a".repeat(1025))).toThrow(/at most 1024/);
  expect(parseObjectKey("a".repeat(1024))).toHaveLength(1024);
});
