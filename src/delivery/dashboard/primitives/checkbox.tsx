import { useEffect, useRef } from "react";

/**
 * The box is 16px because that reads right in a row of them; the label around
 * it is 40x40 so it can actually be hit. Every one carries its own label, since
 * a checkbox in a grid has no visible caption to borrow.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const box = useRef<HTMLInputElement>(null);

  // Half-checked is a property, not an attribute, so it cannot be set in JSX.
  useEffect(() => {
    if (box.current) {
      box.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="inline-flex size-10 cursor-pointer items-center justify-center">
      <input
        ref={box}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--color-accent)]"
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}
