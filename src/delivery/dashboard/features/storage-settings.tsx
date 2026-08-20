import { ConfigField, type ConfigDraft } from "./config-field.tsx";
import { Section } from "../patterns/section.tsx";
import { Hint } from "../primitives/input.tsx";

/**
 * Where object bytes are kept, and how large one may be.
 *
 * Blank means the store that runs beside the stack, which is never published.
 * Naming an endpoint moves the bytes off this machine without changing a line
 * of your app: the rules that decide who may read them are in Postgres either
 * way.
 */
export function StorageSettings({
  draft,
  onChange,
}: {
  draft: ConfigDraft;
  onChange: (name: string, value: string) => void;
}) {
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
      <Hint>
        The bundled store is on the same disk as the database, so it does not survive losing the
        machine either. It is fine for local work and for small apps; it is not a second copy.
      </Hint>
    </Section>
  );
}
