import type { ReactNode } from "react";
import { Field, Input } from "../primitives/input.tsx";

export type ConfigDraft = Record<string, string>;

/**
 * One key from `baseplate.env`, edited by name. The name is shown rather than
 * hidden: an operator who reads the docs, or an error from a service, meets the
 * same word here, and there is nothing gained by inventing a second one.
 */
export function ConfigField({
  name,
  label,
  hint,
  placeholder,
  draft,
  onChange,
  width = "w-full max-w-80",
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  /** What the stack does when this is left blank. */
  placeholder?: string;
  draft: ConfigDraft;
  onChange: (name: string, value: string) => void;
  width?: string;
}) {
  return (
    <div className={width}>
      <Field
        label={label}
        hint={
          <>
            {hint} Sets <code>{name}</code>.
          </>
        }
      >
        <Input
          value={draft[name] ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          onChange={(event) => onChange(name, event.target.value)}
        />
      </Field>
    </div>
  );
}
