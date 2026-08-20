import type { IncomingMessage } from "node:http";
import { expect, test } from "vitest";
import {
  crossSiteReason,
  isLocalhostHost,
  isLoopbackAddress,
} from "../../../src/delivery/operator-http/localhost.ts";

function request(
  method: string,
  headers: Record<string, string | undefined>,
): IncomingMessage {
  return { method, headers } as unknown as IncomingMessage;
}

const OURS = "127.0.0.1:8788";

test("the studio's own calls go through", () => {
  expect(
    crossSiteReason(
      request("POST", {
        host: OURS,
        origin: "http://127.0.0.1:8788",
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
        "content-length": "16",
      }),
    ),
  ).toBeNull();
});

/**
 * The one that matters: a page the operator happens to be looking at can post
 * to localhost without asking anyone, and `{"destroy":true}` would be enough.
 */
test("a form post from another site is refused", () => {
  expect(
    crossSiteReason(
      request("POST", {
        host: OURS,
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "text/plain",
        "content-length": "16",
      }),
    ),
  ).toMatch(/another site/);
});

test("another origin is refused even without fetch metadata", () => {
  expect(
    crossSiteReason(
      request("POST", {
        host: OURS,
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "content-length": "16",
      }),
    ),
  ).toMatch(/another origin/);
});

test("a body that is not json is refused, because a browser cannot send one without asking", () => {
  expect(
    crossSiteReason(
      request("POST", { host: OURS, "content-type": "text/plain", "content-length": "16" }),
    ),
  ).toMatch(/application\/json/);
  expect(
    crossSiteReason(
      request("POST", {
        host: OURS,
        "content-type": "application/x-www-form-urlencoded",
        "content-length": "16",
      }),
    ),
  ).toMatch(/application\/json/);
});

test("a terminal, which sends no origin and no body, is fine", () => {
  expect(crossSiteReason(request("GET", { host: OURS }))).toBeNull();
  expect(crossSiteReason(request("DELETE", { host: OURS }))).toBeNull();
});

test("a charset on the content type is still json", () => {
  expect(
    crossSiteReason(
      request("POST", {
        host: OURS,
        "content-type": "application/json; charset=utf-8",
        "content-length": "16",
      }),
    ),
  ).toBeNull();
});

test("a chunked body without a length is checked too", () => {
  expect(
    crossSiteReason(
      request("POST", { host: OURS, "transfer-encoding": "chunked", "content-type": "text/plain" }),
    ),
  ).toMatch(/application\/json/);
});

test("loopback is recognised however the socket spells it", () => {
  for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "127.0.0.53"]) {
    expect(isLoopbackAddress(address), address).toBe(true);
  }
  for (const address of ["10.0.0.1", "192.168.1.9", "8.8.8.8", undefined, ""]) {
    expect(isLoopbackAddress(address), String(address)).toBe(false);
  }
});

test("a Host header pointing anywhere else is not this machine", () => {
  expect(isLocalhostHost("127.0.0.1:8788")).toBe(true);
  expect(isLocalhostHost("localhost:8788")).toBe(true);
  expect(isLocalhostHost("baseplate.example.com")).toBe(false);
});
