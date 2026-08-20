import { afterEach, expect, test, vi } from "vitest";
import {
  buildRecoveryEmail,
  buildVerifyEmail,
  createMailer,
} from "../../../stack/auth/src/mailer.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

test("the recovery mail carries a reset link and the bare token", () => {
  const mail = buildRecoveryEmail("http://localhost:3000", "tok-abc");
  expect(mail.subject).toBe("Reset your password");
  expect(mail.text).toContain("http://localhost:3000/reset-password?token=tok-abc");
  // The token on a line of its own, for a client that mangles the link.
  expect(mail.text.split("\n")).toContain("tok-abc");
});

test("the verify mail carries a confirm link and the bare token", () => {
  const mail = buildVerifyEmail("http://localhost:3000", "tok-xyz");
  expect(mail.subject).toBe("Confirm your email");
  expect(mail.text).toContain("http://localhost:3000/confirm-email?token=tok-xyz");
  expect(mail.text.split("\n")).toContain("tok-xyz");
});

test("a trailing slash on the site url does not double up", () => {
  expect(buildRecoveryEmail("https://app.example/", "t").text).toContain(
    "https://app.example/reset-password?token=t",
  );
  expect(buildVerifyEmail("https://app.example///", "t").text).toContain(
    "https://app.example/confirm-email?token=t",
  );
});

test("no SMTP host means a mailer that logs and reports nothing was sent", async () => {
  const written: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  });
  const mailer = createMailer({});
  const sent = await mailer.send({
    to: "someone@example.com",
    subject: "Reset your password",
    text: "body",
  });
  expect(sent).toBe(false);
  expect(written.join("")).toContain(
    "auth: email not configured, would have sent Reset your password to someone@example.com",
  );
});

test("a blank SMTP host counts as no host at all", async () => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const mailer = createMailer({ SMTP_HOST: "   " });
  expect(await mailer.send({ to: "a@b.co", subject: "s", text: "t" })).toBe(false);
});

test("a send that fails resolves false instead of throwing", async () => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  // Nothing listens on this port, so the transport cannot connect.
  const mailer = createMailer({
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1",
    SMTP_FROM: "Test <t@example.com>",
  });
  await expect(
    mailer.send({ to: "a@b.co", subject: "s", text: "t" }),
  ).resolves.toBe(false);
}, 20_000);
