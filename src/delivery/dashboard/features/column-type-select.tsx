import { COLUMN_TYPES, type ColumnType } from "../lib/api/types.ts";
import { Select } from "../primitives/select.tsx";

/**
 * The column types the schema API accepts. It lives here rather than inside the
 * new-table form because adding a column to a table that already exists asks
 * exactly the same question.
 */
export function ColumnTypeSelect({
  value,
  onChange,
  label,
  className,
}: {
  value: ColumnType;
  onChange: (type: ColumnType) => void;
  /** Given when the select has no visible label of its own, as in a grid of rows. */
  label?: string;
  className?: string;
}) {
  return (
    <Select
      {...(label ? { "aria-label": label } : {})}
      {...(className ? { className } : {})}
      value={value}
      onChange={(event) => onChange(event.target.value as ColumnType)}
    >
      {COLUMN_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </Select>
  );
}
