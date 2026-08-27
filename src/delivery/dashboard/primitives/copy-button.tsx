import { useEffect, useRef, useState } from "react";
import { Button } from "./button.tsx";
import { IconCheck, IconCopy } from "./icon.tsx";
import { IconSwap } from "./icon-swap.tsx";

type State = "idle" | "copied" | "failed";

/**
 * Copying gives no feedback of its own, so the button does: the icon and label
 * change, and the change is announced. A refused clipboard is reported, or the
 * value is silently not on it.
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
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function settle(next: State): void {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      settle("copied");
    } catch {
      settle("failed");
    }
  }

  return (
    <Button
      variant="secondary"
      className={className}
      onClick={() => void copy()}
      aria-label={state === "failed" ? `${label} failed` : label}
    >
      <IconSwap showSecond={state === "copied"} first={<IconCopy />} second={<IconCheck />} />
      <span aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Select it and copy" : label}
      </span>
    </Button>
  );
}
