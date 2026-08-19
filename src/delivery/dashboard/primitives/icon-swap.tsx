import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

const layer =
  "absolute inset-0 flex items-center justify-center transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
const shown = "opacity-100 scale-100 blur-0";
const hidden = "opacity-0 scale-25 blur-[4px]";

/**
 * Two icons that trade places. Both stay in the DOM and cross-fade, so the
 * outgoing icon gets an exit as well as the incoming one getting an entrance.
 */
export function IconSwap({
  showSecond,
  first,
  second,
}: {
  showSecond: boolean;
  first: ReactNode;
  second: ReactNode;
}) {
  return (
    <span className="relative inline-flex size-[var(--size-icon)] shrink-0" aria-hidden="true">
      <span className={cn(layer, showSecond ? hidden : shown)}>{first}</span>
      <span className={cn(layer, showSecond ? shown : hidden)}>{second}</span>
    </span>
  );
}
