import { sleep, stackEnv } from "./stack.ts";

/**
 * Mailpit is the local stack's inbox. It is the only way a test can see what a
 * user would have received, which is the whole point of the reset flow: the
 * token never appears in an HTTP response.
 *
 * Its REST API is two calls - search for the messages sent to an address, then
 * fetch one by id to get the body.
 */
const MAILPIT_URL = `http://127.0.0.1:${stackEnv("MAILPIT_UI_PORT", "8025")}`;

type Summary = { ID: string; Subject: string; Created: string };
type Message = { ID: string; Subject: string; Text: string };

export async function messagesFor(email: string): Promise<Summary[]> {
  const query = encodeURIComponent(`to:${email}`);
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  if (!response.ok) {
    throw new Error(`mailpit search answered ${String(response.status)}`);
  }
  return ((await response.json()) as { messages?: Summary[] }).messages ?? [];
}

export async function readMessage(id: string): Promise<Message> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!response.ok) {
    throw new Error(`mailpit message ${id} answered ${String(response.status)}`);
  }
  return (await response.json()) as Message;
}

/** How long a best-effort email is given to arrive before the test gives up. */
const DELIVERY_TIMEOUT_MS = 25_000;
const POLL_EVERY_MS = 400;

/**
 * The auth service does not await the send - waiting on a mail server would
 * time how long the account lookup took - so the token shows up shortly after
 * the 200, not before it.
 */
export async function waitForEmail(email: string, subject: string): Promise<Message> {
  const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
  for (;;) {
    const summaries = await messagesFor(email);
    const match = summaries.find((summary) => summary.Subject === subject);
    if (match) {
      return await readMessage(match.ID);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `no '${subject}' mail for ${email} within ${String(DELIVERY_TIMEOUT_MS)}ms` +
          ` (saw ${String(summaries.length)} message(s))`,
      );
    }
    await sleep(POLL_EVERY_MS);
  }
}

export function waitForRecoveryEmail(email: string): Promise<Message> {
  return waitForEmail(email, "Reset your password");
}

/**
 * The body carries the token twice: inside the link, and on a line of its own
 * for mail clients that mangle links. Reading the bare line proves the part an
 * app developer without a reset page would have to fall back to.
 */
export function tokenFromBody(text: string): string {
  const bare = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^[A-Za-z0-9_-]{32,}$/.test(line));
  const linked = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(text)?.[1];
  const token = bare ?? linked;
  if (!token) {
    throw new Error(`no token in the mail body:\n${text}`);
  }
  return token;
}

export async function waitForRecoveryToken(email: string): Promise<string> {
  return tokenFromBody((await waitForRecoveryEmail(email)).Text);
}
