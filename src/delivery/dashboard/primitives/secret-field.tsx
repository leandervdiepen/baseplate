import { useState } from "react";
import { IconEye, IconEyeOff } from "./icon.tsx";
import { IconSwap } from "./icon-swap.tsx";
import { Field, Input } from "./input.tsx";

export function SecretField({
  label,
  value,
  onChange,
  stored,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stored: boolean;
  hint: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          placeholder={stored ? "Stored on this machine" : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="pe-11 font-mono tracking-[0.1em]"
        />
        <button
          type="button"
          className="absolute end-0.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-[color] duration-[var(--duration-hover)] hover:text-[var(--color-text)]"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
        >
          <IconSwap showSecond={visible} first={<IconEye />} second={<IconEyeOff />} />
        </button>
      </div>
    </Field>
  );
}
