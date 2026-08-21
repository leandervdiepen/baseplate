import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { ManageUsers } from "#application";
import { MemoryUserAdmin } from "#infrastructure";
import { beforeEach, expect, test, vi } from "vitest";

const users = new MemoryUserAdmin();

// The route opens the operator itself, the way every other one does. Here that
// is a fake holding a MemoryUserAdmin, so the route is tested and Postgres is
// not.
vi.mock("../../../src/delivery/operator-setup.ts", () => ({
  createOperatorFor: () => ({
    users: new ManageUsers({ users }),
    close: async () => undefined,
  }),
  siteUrlFromEnv: () => "https://app.example.test",
}));

const { sendError } = await import("../../../src/delivery/operator-http/json.ts");
const { handleUsersRoute } = await import("../../../src/delivery/operator-http/users.ts");

const ROOTS = { packageRoot: "/pkg", projectRoot: "/project" };

type Answer = { status: number; body: Record<string, unknown> };

/**
 * The route throws its coded errors and the dispatcher turns them into a
 * payload, so the test stands where the dispatcher does.
 */
async function call(method: string, target: string, body?: unknown): Promise<Answer> {
  const url = new URL(target, "http://127.0.0.1");
  const req = Readable.from(
    body === undefined ? [] : [Buffer.from(JSON.stringify(body))],
  ) as unknown as IncomingMessage;
  const answer: Answer = { status: 0, body: {} };
  const res = {
    writeHead(status: number) {
      answer.status = status;
      return res;
    },
    end(payload: string) {
      answer.body = JSON.parse(payload) as Record<string, unknown>;
    },
  } as unknown as ServerResponse;
  try {
    await handleUsersRoute(ROOTS, url.pathname, method, url, req, res);
  } catch (error) {
    sendError(res, error);
  }
  return answer;
}

beforeEach(() => {
  users.rows.length = 0;
  users.links.length = 0;
  users.passwords.clear();
  users.sessions.clear();
});

test("an empty project lists nobody rather than failing", async () => {
  const answer = await call("GET", "/api/users");
  expect(answer.status).toBe(200);
  expect(answer.body).toEqual({ live: true, total: 0, users: [] });
});

test("created users come back newest first, with a total for the pager", async () => {
  await call("POST", "/api/users", { email: "Ada@Example.com", password: "correct-horse" });
  await call("POST", "/api/users", { email: "grace@example.com", password: "correct-horse" });

  const answer = await call("GET", "/api/users?limit=1&offset=0");
  expect(answer.status).toBe(200);
  expect(answer.body.total).toBe(2);
  expect((answer.body.users as { email: string }[]).map((row) => row.email)).toEqual([
    "grace@example.com",
  ]);
});

test("search narrows the list without changing the shape", async () => {
  await call("POST", "/api/users", { email: "ada@example.com", password: "correct-horse" });
  await call("POST", "/api/users", { email: "grace@other.test", password: "correct-horse" });

  const answer = await call("GET", "/api/users?search=other");
  expect(answer.body.total).toBe(1);
  expect((answer.body.users as { email: string }[])[0]?.email).toBe("grace@other.test");
});

test("creating a user normalizes the address and says whether it is confirmed", async () => {
  const answer = await call("POST", "/api/users", {
    email: "  Ada@Example.COM ",
    password: "correct-horse",
    confirmed: true,
  });
  expect(answer.status).toBe(200);
  const user = answer.body.user as { email: string; emailConfirmedAt?: string };
  expect(user.email).toBe("ada@example.com");
  expect(user.emailConfirmedAt).toBeTypeOf("string");
});

test("an address that is already taken says so, and does not make a second row", async () => {
  await call("POST", "/api/users", { email: "ada@example.com", password: "correct-horse" });
  const answer = await call("POST", "/api/users", {
    email: "ada@example.com",
    password: "correct-horse",
  });
  expect(answer.status).toBe(400);
  expect(answer.body.code).toBe("users.email_taken");
  expect(users.rows).toHaveLength(1);
});

test.for([
  ["nope", "users.invalid_email", { email: "nope", password: "correct-horse" }],
  ["short", "users.weak_password", { email: "ada@example.com", password: "short" }],
])("a bad %s is a named 400, not a 500", async ([, code, body]) => {
  const answer = await call("POST", "/api/users", body);
  expect(answer.status).toBe(400);
  expect(answer.body.code).toBe(code);
});

test("deleting a user that is there removes them, and one that is not is a 404", async () => {
  const made = await call("POST", "/api/users", {
    email: "ada@example.com",
    password: "correct-horse",
  });
  const id = (made.body.user as { id: string }).id;

  expect(await call("DELETE", `/api/users?id=${id}`)).toEqual({
    status: 200,
    body: { removed: true },
  });
  const missing = await call("DELETE", `/api/users?id=${id}`);
  expect(missing.status).toBe(404);
  expect(missing.body.code).toBe("users.not_found");
});

test("a recovery link points at the site and comes with an expiry", async () => {
  const made = await call("POST", "/api/users", {
    email: "ada@example.com",
    password: "correct-horse",
  });
  const id = (made.body.user as { id: string }).id;

  const answer = await call("POST", "/api/users/recovery-link", { id });
  expect(answer.status).toBe(200);
  expect(String(answer.body.link)).toMatch(/^https:\/\/app\.example\.test\/reset-password\?token=/);
  expect(answer.body.expiresAt).toBeTypeOf("string");
});

test("resetting a password ends the sessions that knew the old one", async () => {
  const made = await call("POST", "/api/users", {
    email: "ada@example.com",
    password: "correct-horse",
  });
  const id = (made.body.user as { id: string }).id;
  users.sessions.set(id, 3);

  expect(await call("POST", "/api/users/reset-password", { id, password: "battery-staple" })).toEqual(
    { status: 200, body: { ok: true } },
  );
  expect(users.passwords.get(id)).toBe("battery-staple");
  expect(users.sessions.get(id)).toBe(0);
});

test("revoking sessions counts what it ended", async () => {
  const made = await call("POST", "/api/users", {
    email: "ada@example.com",
    password: "correct-horse",
  });
  const id = (made.body.user as { id: string }).id;
  users.sessions.set(id, 2);

  expect(await call("POST", "/api/users/revoke-sessions", { id })).toEqual({
    status: 200,
    body: { revoked: 2 },
  });
});

test("every route that acts on one person insists on being told which", async () => {
  for (const path of [
    "/api/users/recovery-link",
    "/api/users/reset-password",
    "/api/users/revoke-sessions",
  ]) {
    const answer = await call("POST", path, {});
    expect(answer.status, path).toBe(400);
    expect(answer.body.code, path).toBe("users.id_required");
  }
});

test("an unknown users route is a 404, not the app's auth service", async () => {
  const answer = await call("GET", "/api/users/whatever");
  expect(answer.status).toBe(404);
  expect(answer.body.code).toBe("operator.not_found");
});
