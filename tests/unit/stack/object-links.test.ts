import { expect, test } from "vitest";
import { checkObjectUrl, signObjectUrl } from "../../../stack/storage/src/sign.ts";

const SECRET = "a-secret-that-is-at-least-32-characters-long";
const NOW = 1_800_000_000;

test("a link the stack signed opens the object it was signed for", () => {
  const token = signObjectUrl(SECRET, "avatars", "me.png", NOW + 60);
  expect(checkObjectUrl(SECRET, "avatars", "me.png", token, NOW)).toEqual({ ok: true });
});

test("a link stops working when it expires", () => {
  const token = signObjectUrl(SECRET, "avatars", "me.png", NOW + 60);
  expect(checkObjectUrl(SECRET, "avatars", "me.png", token, NOW + 61)).toEqual({
    ok: false,
    reason: "expired",
  });
});

/** Otherwise one link would be a key to every object in the stack. */
test("a link is not valid for another object", () => {
  const token = signObjectUrl(SECRET, "avatars", "me.png", NOW + 60);
  expect(checkObjectUrl(SECRET, "avatars", "you.png", token, NOW).ok).toBe(false);
  expect(checkObjectUrl(SECRET, "invoices", "me.png", token, NOW).ok).toBe(false);
});

test("moving the expiry breaks the signature rather than extending the link", () => {
  const token = signObjectUrl(SECRET, "avatars", "me.png", NOW + 60);
  const forged = token.replace(String(NOW + 60), String(NOW + 60_000));
  expect(checkObjectUrl(SECRET, "avatars", "me.png", forged, NOW)).toEqual({
    ok: false,
    reason: "invalid",
  });
});

test("a link signed with another secret is not valid here", () => {
  const token = signObjectUrl(
    "a-different-secret-of-at-least-32-chars!!",
    "avatars",
    "me.png",
    NOW + 60,
  );
  expect(checkObjectUrl(SECRET, "avatars", "me.png", token, NOW).ok).toBe(false);
});

test("nonsense in the query string is refused, not crashed on", () => {
  for (const token of ["", ".", "abc", "abc.def", `${String(NOW + 60)}.`, "..."]) {
    expect(checkObjectUrl(SECRET, "avatars", "me.png", token, NOW).ok, token).toBe(false);
  }
});
