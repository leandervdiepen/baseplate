import { ConfigField, type ConfigDraft } from "./config-field.tsx";
import { Callout } from "../patterns/callout.tsx";
import { Section } from "../patterns/section.tsx";
import { IconMail } from "../primitives/icon.tsx";
import { Field, Hint } from "../primitives/input.tsx";
import { SecretField } from "../primitives/secret-field.tsx";
import { Segmented } from "../primitives/segmented.tsx";

const ENCRYPTION = [
  { id: "none", label: "None" },
  { id: "starttls", label: "STARTTLS" },
  { id: "tls", label: "TLS" },
];

const CONFIRMATION = [
  { id: "false", label: "Not required" },
  { id: "true", label: "Required" },
];

/**
 * Whether a forgotten password can be recovered at all. A local stack never
 * makes you think about it - mail lands in the inbox beside it - and a server
 * has no such inbox, so the studio says which of the two you are looking at.
 */
export function EmailSettings({
  draft,
  cloud,
  secretStored,
  onChange,
}: {
  draft: ConfigDraft;
  /** A server has no dev inbox to fall back on. */
  cloud: boolean;
  secretStored: boolean;
  onChange: (name: string, value: string) => void;
}) {
  const relay = (draft.SMTP_HOST ?? "").trim().length > 0;

  return (
    <Section title="Email">
      <ConfigField
        name="SITE_URL"
        label="Where your app is served"
        placeholder="http://localhost:3000"
        hint="Reset and confirmation links point here, so it has to be an address the person clicking one can reach. It is your app's address, not this API's."
        draft={draft}
        onChange={onChange}
      />

      {relay ? null : (
        <Callout icon={<IconMail width={16} height={16} />}>
          {cloud
            ? "No mail server, and no inbox on a server to fall back on. Recovery links will be issued and never delivered until you name one below."
            : "Mail is going to the inbox that runs beside the stack, where you can read a reset link without a mail account. Name a server below before anyone outside this machine signs up."}
        </Callout>
      )}

      <ConfigField
        name="SMTP_HOST"
        label="Mail server"
        placeholder={cloud ? "smtp.your-provider.com" : "the local inbox"}
        hint="Your provider's SMTP host. Blank keeps the local inbox on this machine."
        draft={draft}
        onChange={onChange}
      />
      <div className="flex flex-wrap items-start gap-[var(--space-lg)]">
        <ConfigField
          name="SMTP_PORT"
          label="Port"
          placeholder="1025"
          width="w-32"
          hint="587 with STARTTLS, 465 with TLS."
          draft={draft}
          onChange={onChange}
        />
        <Field
          label="Encryption"
          hint={
            <>
              How the connection is protected. Sets <code>SMTP_SECURE</code>.
            </>
          }
        >
          <Segmented
            label="Mail encryption"
            value={draft.SMTP_SECURE || "none"}
            options={ENCRYPTION}
            onChange={(value) => onChange("SMTP_SECURE", value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-start gap-[var(--space-md)]">
        <ConfigField
          name="SMTP_USER"
          label="Username"
          width="w-72"
          hint="Whatever your provider issued."
          draft={draft}
          onChange={onChange}
        />
        <div className="w-72">
          <SecretField
            label="Password"
            value={draft.SMTP_PASS ?? ""}
            stored={secretStored}
            hint="Sets SMTP_PASS. It crosses to the server, because the server is what sends the mail."
            onChange={(value) => onChange("SMTP_PASS", value)}
          />
        </div>
      </div>
      <ConfigField
        name="SMTP_FROM"
        label="From"
        placeholder="Baseplate <no-reply@localhost>"
        hint="What a recipient sees. Most providers insist this is an address you have proved you own."
        draft={draft}
        onChange={onChange}
      />

      <Field
        label="Email confirmation"
        hint={
          <>
            Whether a new account has to click the link before it can sign in. Sets{" "}
            <code>REQUIRE_EMAIL_CONFIRM</code>.
          </>
        }
      >
        <Segmented
          label="Email confirmation"
          value={draft.REQUIRE_EMAIL_CONFIRM === "true" ? "true" : "false"}
          options={CONFIRMATION}
          onChange={(value) => onChange("REQUIRE_EMAIL_CONFIRM", value)}
        />
      </Field>
      {draft.REQUIRE_EMAIL_CONFIRM === "true" && !relay ? (
        <Hint>
          Requiring confirmation with no mail server means nobody can finish signing up.
        </Hint>
      ) : null}

      {cloud ? null : (
        <ConfigField
          name="MAILPIT_UI_PORT"
          label="Local inbox port"
          placeholder="8025"
          width="w-40"
          hint="Where to read the inbox beside the stack, on 127.0.0.1 only."
          draft={draft}
          onChange={onChange}
        />
      )}
    </Section>
  );
}
