import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, expect, test } from "vitest";
import { MAX_BODY_BYTES, readJsonBody, sendJson } from "../../../stack/auth/src/http.ts";

/**
 * Auth is what an unauthenticated stranger reaches, and it used to read
 * whatever they sent in full. Over a real socket, because the point is what
 * happens while the body is arriving.
 */

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    void readJsonBody(req, res).then((body) => {
      if (body) {
        sendJson(res, 200, { read: Object.keys(body).length });
      }
    });
  });
  await new Promise<void>((done) => {
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  base = `http://127.0.0.1:${String(typeof address === "object" && address ? address.port : 0)}`;
});

afterAll(async () => {
  await new Promise<void>((done) => {
    server.close(() => done());
  });
});

function post(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test("an ordinary credentials body is read", async () => {
  const response = await post(JSON.stringify({ email: "a@b.co", password: "a-long-password" }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ read: 2 });
});

test("an empty body is an empty object, not an error", async () => {
  const response = await post("");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ read: 0 });
});

test("a body over the limit is refused with 413", async () => {
  const response = await post(JSON.stringify({ password: "x".repeat(MAX_BODY_BYTES) }));

  expect(response.status).toBe(413);
  expect((await response.json()).code).toBe("auth.body_too_large");
});

test("a body that lies about being small is still refused once it is too big", async () => {
  // Chunked: no content-length to check up front.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const block = new TextEncoder().encode("x".repeat(1024));
      for (let sent = 0; sent < MAX_BODY_BYTES * 2; sent += block.length) {
        controller.enqueue(block);
      }
      controller.close();
    },
  });

  const response = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    // Node needs telling that a streamed body is half duplex.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  expect(response.status).toBe(413);
});

test("a body that is not JSON is a 400 rather than a 500", async () => {
  const response = await post("{not json");

  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe("auth.invalid_json");
});

test("a JSON array is not a body any route can use", async () => {
  const response = await post("[1,2,3]");

  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe("auth.invalid_json");
});
