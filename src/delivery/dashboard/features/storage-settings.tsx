import { ConfigField, type ConfigDraft } from "./config-field.tsx";
import { Callout } from "../patterns/callout.tsx";
import { Section } from "../patterns/section.tsx";
import { IconLock } from "../primitives/icon.tsx";
import { Hint } from "../primitives/input.tsx";
import { SecretField } from "../primitives/secret-field.tsx";

/** The store that ships beside the stack, which needs no credentials typed. */
const BUNDLED_ENDPOINT = "storage-blobs";

/**
 * Where object bytes are kept. Blank is the store beside the stack, never
 * published; naming an endpoint moves the bytes without changing a line of the
 * app, because who may read them is decided in Postgres either way.
 */
export function StorageSettings({
  draft,
  storedSecrets,
  onChange,
}: {
  draft: ConfigDraft;
  storedSecrets: Record<string, boolean>;
  onChange: (name: string, value: string) => void;
}) {
  // Blank is the bundled store too: that is what the stack defaults to.
  const endpoint = (draft.STORAGE_ENDPOINT ?? "").trim();
  const external = endpoint.length > 0 && !endpoint.includes(BUNDLED_ENDPOINT);

  return (
    <Section title="Storage">
      <ConfigField
        name="STORAGE_MAX_BYTES"
        label="Largest upload"
        placeholder="26214400"
        width="w-56"
        hint="In bytes. 25 MB by default."
        draft={draft}
        onChange={onChange}
      />
      <ConfigField
        name="STORAGE_ENDPOINT"
        label="Object store endpoint"
        placeholder="http://storage-blobs:8333"
        hint="Blank keeps the bytes in the store beside your stack. Point it at Hetzner Object Storage, Backblaze B2, or S3 to move them."
        draft={draft}
        onChange={onChange}
      />
      <div className="flex flex-wrap items-end gap-[var(--space-md)]">
        <ConfigField
          name="STORAGE_BUCKET"
          label="Bucket"
          placeholder="baseplate"
          width="w-56"
          hint="The one bucket objects are kept in."
          draft={draft}
          onChange={onChange}
        />
        <ConfigField
          name="STORAGE_REGION"
          label="Region"
          placeholder="us-east-1"
          width="w-56"
          hint="Whatever your provider calls it."
          draft={draft}
          onChange={onChange}
        />
      </div>
      {external ? (
        <>
          <Callout icon={<IconLock width={16} height={16} />}>
            Your provider issued its own keys. Until they are here, the stack is still presenting
            the pair it generated for the bundled store, and every upload will be refused.
          </Callout>
          <div className="flex flex-wrap items-start gap-[var(--space-md)]">
            <div className="w-72">
              <SecretField
                label="Access key"
                value={draft.STORAGE_ACCESS_KEY ?? ""}
                stored={storedSecrets.STORAGE_ACCESS_KEY ?? false}
                hint="Sets STORAGE_ACCESS_KEY. Scoped to that one bucket, if your provider allows it."
                onChange={(value) => onChange("STORAGE_ACCESS_KEY", value)}
              />
            </div>
            <div className="w-72">
              <SecretField
                label="Secret key"
                value={draft.STORAGE_SECRET_KEY ?? ""}
                stored={storedSecrets.STORAGE_SECRET_KEY ?? false}
                hint="Sets STORAGE_SECRET_KEY. It crosses to the server, because the server is what reads and writes the bytes."
                onChange={(value) => onChange("STORAGE_SECRET_KEY", value)}
              />
            </div>
          </div>
        </>
      ) : null}

      <Hint>
        The bundled store is on the same disk as the database, so it does not survive losing the
        machine either. It is fine for local work and for small apps; it is not a second copy.
      </Hint>
    </Section>
  );
}
