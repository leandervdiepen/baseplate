import type { Transporter } from "nodemailer";

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

export type Mailer = {
  /** True when the message was handed to the server. Never throws. */
  send(mail: Mail): Promise<boolean>;
};

export type MailEnv = Record<string, string | undefined>;

const DEFAULT_FROM = "Baseplate <no-reply@localhost>";

/**
 * Mail is best-effort. A stack with no SMTP host still signs people in and
 * still hands out recovery tokens; it just cannot deliver them, and says so in
 * the log instead of failing the request that asked.
 */
export function createMailer(env: MailEnv): Mailer {
  const host = (env.SMTP_HOST ?? "").trim();
  if (!host) {
    return {
      async send(mail) {
        log(`email not configured, would have sent ${mail.subject} to ${mail.to}`);
        return false;
      },
    };
  }
  const from = env.SMTP_FROM?.trim() || DEFAULT_FROM;
  const options = transportOptions(host, env);
  let transport: Transporter | undefined;
  return {
    async send(mail) {
      try {
        const { createTransport } = await import("nodemailer");
        transport ??= createTransport(options);
        await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
        return true;
      } catch (error) {
        log(`could not send ${mail.subject} to ${mail.to}: ${describe(error)}`);
        return false;
      }
    },
  };
}

/**
 * `none` is plain SMTP, which is what the local Mailpit inbox speaks. Anything
 * reachable over a network wants `starttls` (port 587) or `tls` (port 465).
 */
function transportOptions(host: string, env: MailEnv) {
  const secure = env.SMTP_SECURE?.trim() || "none";
  const user = env.SMTP_USER?.trim() ?? "";
  const pass = env.SMTP_PASS ?? "";
  return {
    host,
    port: Number(env.SMTP_PORT ?? "1025") || 1025,
    secure: secure === "tls",
    requireTLS: secure === "starttls",
    ...(user ? { auth: { user, pass } } : {}),
  };
}

export type EmailBody = { subject: string; text: string };

export function buildRecoveryEmail(siteUrl: string, token: string): EmailBody {
  return {
    subject: "Reset your password",
    text: [
      "Someone asked to reset the password for this address.",
      "",
      "Open this link to choose a new one:",
      `${trimSlash(siteUrl)}/reset-password?token=${token}`,
      "",
      "The token on its own, if the link does not survive your mail client:",
      token,
      "",
      "It works once and expires in an hour. If this was not you, ignore this mail.",
    ].join("\n"),
  };
}

export function buildVerifyEmail(siteUrl: string, token: string): EmailBody {
  return {
    subject: "Confirm your email",
    text: [
      "Confirm this address to finish setting up your account.",
      "",
      "Open this link to confirm:",
      `${trimSlash(siteUrl)}/confirm-email?token=${token}`,
      "",
      "The token on its own, if the link does not survive your mail client:",
      token,
      "",
      "It works once and expires in a day.",
    ].join("\n"),
  };
}

function trimSlash(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function log(line: string): void {
  process.stdout.write(`auth: ${line}\n`);
}
