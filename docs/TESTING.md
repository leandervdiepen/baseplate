# Testing an app against Baseplate

End-to-end tests that run against a real stack exercise the real access rules.
A mocked backend can only prove your client sends what you told it to send; a real one proves the database refuses what it should refuse.

Users are cheap. Each is one HTTP call, so a test can make its own and never share state with another.

## Setup

```bash
npm i -D @playwright/test
npx playwright install chromium
```

`baseplate up` returns once the stack is healthy rather than staying in the foreground, so it belongs in `globalSetup` rather than in `webServer`.
Running it against a stack that is already up is a no-op, which makes it safe to repeat.

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./tests/e2e/stack.ts",
  webServer: { command: "npm run dev", url: "http://127.0.0.1:5173", reuseExistingServer: true },
  use: { baseURL: "http://127.0.0.1:5173" },
});
```

```ts
// tests/e2e/stack.ts
import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync("npx", ["@diepen/baseplate", "up"], { stdio: "inherit" });
}
```

One stack runs at a time, so give CI one project directory rather than one per suite.

## Two callers, one endpoint

This is the test worth writing first, because it is the one that fails loudly if row access is ever misconfigured.

```ts
// tests/e2e/rls.spec.ts
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API = process.env.BASEPLATE_URL ?? "http://127.0.0.1:8080";

// Credential endpoints allow ten calls a minute per IP, so a suite with more
// signups than that waits out the 429 instead of failing on it.
async function signUp() {
  for (;;) {
    const response = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `e2e-${randomUUID()}@example.test`, password: "a-good-password" }),
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? "5");
      await new Promise((done) => setTimeout(done, wait * 1000));
      continue;
    }
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { token: string; user: { id: string } };
  }
}

test("each caller sees only their own rows", async () => {
  const alice = await signUp();
  const bob = await signUp();

  await fetch(`${API}/notes`, {
    method: "POST",
    headers: { authorization: `Bearer ${alice.token}`, "content-type": "application/json" },
    body: JSON.stringify({ title: "alice only" }),
  });

  const mine = await (await fetch(`${API}/notes`, {
    headers: { authorization: `Bearer ${alice.token}` },
  })).json();
  const theirs = await (await fetch(`${API}/notes`, {
    headers: { authorization: `Bearer ${bob.token}` },
  })).json();

  expect(mine).toHaveLength(1);
  expect(theirs).toHaveLength(0);
});
```

Nothing in the test filters by user, and nothing in your app does either.
Bob gets an empty array because Postgres decided that.

## A signed-in browser

Driving your login form on every test is slow and tests the form rather than the feature.
Write the session into `localStorage` before the page loads and the client picks it up on startup.

```ts
import { SESSION_KEY } from "@diepen/baseplate/client";

const session = await signUp();
await page.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, value),
  [SESSION_KEY, JSON.stringify({ ...session, expiresAt: Date.now() + session.expiresIn * 1000 })],
);
await page.goto("/");
```

`expiresAt` is milliseconds since the epoch. The client refreshes the token before it lapses, so a long suite does not need to think about expiry.

Keep one test that signs in through the form. That one is testing the form.

## As a fixture

Most tests want a signed-in page rather than a token, so make that the default.

```ts
// tests/e2e/fixtures.ts
import { test as base } from "@playwright/test";
import { SESSION_KEY } from "@diepen/baseplate/client";

export const test = base.extend<{ signedIn: { token: string; id: string } }>({
  signedIn: async ({ page }, use) => {
    const session = await signUp();
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SESSION_KEY, JSON.stringify({ ...session, expiresAt: Date.now() + session.expiresIn * 1000 })],
    );
    await use({ token: session.token, id: session.user.id });
  },
});
```

```ts
import { expect } from "@playwright/test";
import { test } from "./fixtures.ts";

test("a new account starts with an empty board list", async ({ page, signedIn }) => {
  await page.goto("/");
  await expect(page.getByText("No boards yet")).toBeVisible();
});
```

## Files

Objects follow the same rule as rows, so the same shape of test applies.

```ts
test("a caller cannot read someone else's object, even knowing the key", async () => {
  const alice = await signUp();
  const bob = await signUp();

  await fetch(`${API}/storage/avatars/me.png`, {
    method: "PUT",
    headers: { authorization: `Bearer ${alice.token}`, "content-type": "image/png" },
    body: new Uint8Array([1, 2, 3]),
  });

  const theirs = await fetch(`${API}/storage/avatars/me.png`, {
    headers: { authorization: `Bearer ${bob.token}` },
  });
  expect(theirs.status).toBe(404);
});
```

404 rather than 403, because a row Bob cannot see does not exist as far as he is concerned.

## Resetting between runs

Tests that make their own users do not need a reset: a fresh account starts empty by definition.
That is the cheapest isolation available and it is worth leaning on.

When you do need to start clean:

```bash
npx @diepen/baseplate destroy --yes && npx @diepen/baseplate up
```

That deletes the volume, so point it at a project directory used only for testing.
