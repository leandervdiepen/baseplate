import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { encodeKey, parseListing, signRequest } from "../../../stack/shared/s3.ts";

/**
 * The worked example AWS publishes for "GET Object" under Signature Version 4.
 * Every byte an operator stores is signed by this code, so it is checked against
 * someone else's arithmetic rather than its own.
 */
const AWS_EXAMPLE = {
  accessKey: "AKIAIOSFODNN7EXAMPLE",
  secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
};
const EMPTY_SHA256 = createHash("sha256").update("").digest("hex");

test("signs the GET Object example the way AWS documents it", () => {
  const headers = signRequest({
    method: "GET",
    url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
    headers: { range: "bytes=0-9" },
    config: AWS_EXAMPLE,
    now: new Date("2013-05-24T00:00:00Z"),
    payloadHash: EMPTY_SHA256,
  });

  expect(headers.authorization).toBe(
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
      "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, " +
      "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
  );
});

test("signs the list-objects example, where the query string is part of it", () => {
  const url = new URL("https://examplebucket.s3.amazonaws.com/");
  url.searchParams.set("max-keys", "2");
  url.searchParams.set("prefix", "J");

  const headers = signRequest({
    method: "GET",
    url,
    headers: {},
    config: AWS_EXAMPLE,
    now: new Date("2013-05-24T00:00:00Z"),
    payloadHash: EMPTY_SHA256,
  });

  expect(headers.authorization).toContain(
    "Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7",
  );
});

test("the date header is the compact form S3 wants", () => {
  const headers = signRequest({
    method: "GET",
    url: new URL("https://b.example.com/k"),
    headers: {},
    config: AWS_EXAMPLE,
    now: new Date("2026-08-20T09:41:02.512Z"),
  });
  expect(headers["x-amz-date"]).toBe("20260820T094102Z");
  expect(headers["x-amz-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
});

test("a key keeps its slashes and loses everything else that is not safe", () => {
  expect(encodeKey("avatars/me.png")).toBe("avatars/me.png");
  expect(encodeKey("holiday photos/one (1).jpg")).toBe("holiday%20photos/one%20%281%29.jpg");
  expect(encodeKey("test$file.text")).toBe("test%24file.text");
});

test("a listing reads back keys, sizes, and etags", () => {
  const xml = `<?xml version="1.0"?><ListBucketResult>
    <Contents><Key>a/one.png</Key><Size>12</Size><ETag>&quot;abc&quot;</ETag>
      <LastModified>2026-08-20T09:00:00.000Z</LastModified></Contents>
    <Contents><Key>a/two &amp; three.png</Key><Size>7</Size><ETag>&quot;def&quot;</ETag></Contents>
  </ListBucketResult>`;

  expect(parseListing(xml)).toEqual([
    { key: "a/one.png", size: 12, etag: "abc", lastModified: Date.parse("2026-08-20T09:00:00Z") },
    { key: "a/two & three.png", size: 7, etag: "def", lastModified: undefined },
  ]);
});

test("an empty listing is not an error", () => {
  expect(parseListing("<ListBucketResult></ListBucketResult>")).toEqual([]);
});
