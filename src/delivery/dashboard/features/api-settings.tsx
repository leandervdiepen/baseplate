import { ConfigField, type ConfigDraft } from "./config-field.tsx";
import { Section } from "../patterns/section.tsx";
import { Hint } from "../primitives/input.tsx";

/**
 * `*` is right while the only caller is a terminal, and wrong the moment an app
 * has an origin of its own. Nothing else will tell you that.
 */
export function ApiSettings({
  draft,
  onChange,
}: {
  draft: ConfigDraft;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <Section title="API">
      <ConfigField
        name="CORS_ORIGIN"
        label="Allowed browser origin"
        placeholder="*"
        hint="Where a browser app may call this API from. Name your app's origin once it has one."
        draft={draft}
        onChange={onChange}
      />
      <div className="flex flex-wrap items-end gap-[var(--space-md)]">
        <ConfigField
          name="HTTP_PORT"
          label="API port"
          placeholder="8080"
          width="w-40"
          hint="Where the API answers."
          draft={draft}
          onChange={onChange}
        />
        <ConfigField
          name="POSTGRES_PORT"
          label="Postgres port"
          placeholder="5432"
          width="w-40"
          hint="Loopback only, for psql and drizzle-kit."
          draft={draft}
          onChange={onChange}
        />
      </div>
      <Hint>
        A port only moves once the stack is started again. The studio&apos;s own port is not here:
        changing it would move this page out from under you, so it stays{" "}
        <code>baseplate dashboard --port</code>.
      </Hint>
    </Section>
  );
}
