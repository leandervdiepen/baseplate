import { ConfigField, type ConfigDraft } from "./config-field.tsx";
import { Callout } from "../patterns/callout.tsx";
import { Section } from "../patterns/section.tsx";
import { IconLock } from "../primitives/icon.tsx";
import { Hint } from "../primitives/input.tsx";
import { SecretField } from "../primitives/secret-field.tsx";

/**
 * The destination is the part that matters: left blank, backups land on the same
 * disk as the database, which survives a bad migration and nothing else. The
 * studio says so rather than letting "backup" carry a promise it has not earned.
 */
export function BackupSettings({
  draft,
  secretStored,
  onChange,
}: {
  draft: ConfigDraft;
  secretStored: boolean;
  onChange: (name: string, value: string) => void;
}) {
  const offMachine = (draft.BACKUP_S3_BUCKET ?? "").trim().length > 0;

  return (
    <Section title="Backups">
      <div className="flex flex-wrap items-end gap-[var(--space-md)]">
        <ConfigField
          name="BACKUP_EVERY"
          label="Take one every"
          placeholder="24h"
          width="w-40"
          hint="15m, 12h, and 7d all parse."
          draft={draft}
          onChange={onChange}
        />
        <ConfigField
          name="DRILL_EVERY"
          label="Prove one restores every"
          placeholder="168h"
          width="w-52"
          hint="Restores the newest into a scratch database and counts it."
          draft={draft}
          onChange={onChange}
        />
        <ConfigField
          name="BACKUP_KEEP"
          label="Keep"
          placeholder="14"
          width="w-32"
          hint="How many to hold."
          draft={draft}
          onChange={onChange}
        />
      </div>

      {offMachine ? null : (
        <Callout icon={<IconLock width={16} height={16} />}>
          Backups are going to the same machine as the database. Name a bucket below and they go
          somewhere that survives losing it.
        </Callout>
      )}

      <ConfigField
        name="BACKUP_S3_ENDPOINT"
        label="Destination endpoint"
        placeholder="https://fsn1.your-objectstorage.com"
        hint="Any S3-compatible store. Blank keeps them on this machine."
        draft={draft}
        onChange={onChange}
      />
      <div className="flex flex-wrap items-end gap-[var(--space-md)]">
        <ConfigField
          name="BACKUP_S3_BUCKET"
          label="Bucket"
          placeholder="my-backups"
          width="w-56"
          hint="Yours, and only for this."
          draft={draft}
          onChange={onChange}
        />
        <ConfigField
          name="BACKUP_S3_REGION"
          label="Region"
          placeholder="us-east-1"
          width="w-56"
          hint="Whatever your provider calls it."
          draft={draft}
          onChange={onChange}
        />
      </div>
      <div className="flex flex-wrap items-start gap-[var(--space-md)]">
        <ConfigField
          name="BACKUP_S3_ACCESS_KEY"
          label="Access key"
          width="w-72"
          hint="Scoped to that one bucket, if your provider allows it."
          draft={draft}
          onChange={onChange}
        />
        <div className="w-72">
          <SecretField
            label="Secret key"
            value={draft.BACKUP_S3_SECRET_KEY ?? ""}
            stored={secretStored}
            hint="Sets BACKUP_S3_SECRET_KEY. It crosses to the server, because the drill has to open a backup there for the drill to mean anything."
            onChange={(value) => onChange("BACKUP_S3_SECRET_KEY", value)}
          />
        </div>
      </div>
      <Hint>
        Every dump is sealed with a key generated for this project before it leaves. Whoever holds
        the bucket cannot read what is in it.
      </Hint>
    </Section>
  );
}
