import { useEffect, useRef, useState } from "react";
import { Button } from "./button.tsx";
import { IconCheck, IconCopy } from "./icon.tsx";
import { IconSwap } from "./icon-swap.tsx";

/**
 * Copying gives no feedback of its own, so the button has to provide it: the
 * icon changes, the label changes, and the change is announced.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="secondary" className={className} onClick={() => void copy()}>
      <IconSwap showSecond={copied} first={<IconCopy />} second={<IconCheck />} />
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}
