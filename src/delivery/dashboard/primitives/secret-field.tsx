import { useState } from "react";
import { IconEye } from "./icon.tsx";
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
          placeholder={stored ? "stored on this machine" : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="pe-10 font-mono tracking-[0.1em]"
        />
        <button
          type="button"
          className="absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center text-[var(--color-text-muted)]"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide secret" : "Show secret"}
        >
          <IconEye />
        </button>
      </div>
    </Field>
  );
}
