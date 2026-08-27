import { Hint } from "../primitives/input.tsx";
import { Segmented } from "../primitives/segmented.tsx";
import type { TableAccess } from "../lib/api/types.ts";

const LEGEND = "Who may read these rows";

const OPTIONS: { id: TableAccess; label: string }[] = [
  { id: "private", label: "Private" },
  { id: "shared", label: "Shared" },
  { id: "public", label: "Public" },
];

/** The consequence of each mode, in the one sentence the choice turns on. */
export const ACCESS_SUMMARY: Record<TableAccess, string> = {
  private: "Each caller reads only their own rows.",
  shared: "Anyone signed in reads every row.",
  public: "Anyone reads every row, no token needed.",
};

/**
 * `public` is the one mode a reader with no token reaches, so it is the one
 * worth catching an eye. The other two are deliberate and unremarkable.
 */
export const ACCESS_TONE: Record<TableAccess, "accent" | "warn"> = {
  private: "accent",
  shared: "accent",
  public: "warn",
};

export function AccessChoice({
  value,
  onChange,
  disabled,
}: {
  value: TableAccess;
  onChange: (access: TableAccess) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-[var(--space-sm)] text-[length:var(--text-sm)] font-medium">
        {LEGEND}
      </legend>
      <Segmented
        label={LEGEND}
        value={value}
        options={OPTIONS}
        onChange={onChange}
        {...(disabled ? { disabled } : {})}
      />
      <div className="mt-[var(--space-sm)]">
        <Hint>{ACCESS_SUMMARY[value]} A row is written only by whoever owns it.</Hint>
      </div>
    </fieldset>
  );
}
