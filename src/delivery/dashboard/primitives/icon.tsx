import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Every icon is drawn on the same 16 grid at the same stroke weight. Mixing
 * grids makes two icons of equal nominal size read as different weights.
 *
 * The weight lives on the root so it is inherited by every path, which lets a
 * caller thicken an icon to match the text beside it: 1.5 next to regular,
 * nearer 2 next to semibold. A hairline icon beside bold text reads as a
 * different icon set.
 */
function Svg({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function IconTables(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" {...stroke} />
      <path d="M1.5 6H14.5M1.5 10.5H14.5M6 6V14.5" {...stroke} />
    </Svg>
  );
}

export function IconSchema(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="1.5" width="6" height="6" rx="1.2" {...stroke} />
      <rect x="8.5" y="8.5" width="6" height="6" rx="1.2" {...stroke} />
      <path d="M7.5 4.5H10.5V8.5" {...stroke} />
    </Svg>
  );
}

export function IconPolicies(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 1.5L13.5 3.5V7.5C13.5 11 11.2 13.7 8 14.5C4.8 13.7 2.5 11 2.5 7.5V3.5L8 1.5Z" {...stroke} />
      <path d="M5.5 8L7.2 9.7L10.5 6.4" {...stroke} />
    </Svg>
  );
}

export function IconAuth(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="8" r="3.2" {...stroke} />
      <path d="M8.2 8H14.5M12 8V10.5M14.5 8V10" {...stroke} />
    </Svg>
  );
}

/**
 * Two figures, the second half-drawn behind the first: a list of people rather
 * than one account. Same 16 grid, so it sits level with IconAuth beside it.
 */
export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="5.3" r="2.6" {...stroke} />
      <path d="M1.5 13.8C1.5 11.4 3.5 10 6 10s4.5 1.4 4.5 3.8" {...stroke} />
      <path d="M10.6 3.1a2.6 2.6 0 0 1 0 4.4" {...stroke} />
      <path d="M11.9 10.2c1.7.4 2.6 1.6 2.6 3.6" {...stroke} />
    </Svg>
  );
}

export function IconLogs(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="2" width="13" height="12" rx="2" {...stroke} />
      <path d="M4.5 6L6.5 8L4.5 10M8.5 10H11.5" {...stroke} />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.2" {...stroke} />
      <path
        d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6"
        {...stroke}
      />
    </Svg>
  );
}

/** A bucket, drawn on the same 16 grid as the rest. */
export function IconStorage(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 4.5 3.2 13a1.5 1.5 0 0 0 1.5 1.3h6.6a1.5 1.5 0 0 0 1.5-1.3L14 4.5" {...stroke} />
      <ellipse cx="8" cy="4" rx="6" ry="2.3" {...stroke} />
    </Svg>
  );
}

/** An archive box, for backups. */
export function IconBackups(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="2" width="13" height="3.5" rx="1" {...stroke} />
      <path d="M2.75 5.5V13a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5V5.5" {...stroke} />
      <path d="M6.25 8.5h3.5" {...stroke} />
    </Svg>
  );
}

/** Four panes: the shape of a page that is a summary of other pages. */
export function IconOverview(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" {...stroke} />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" {...stroke} />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" {...stroke} />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" {...stroke} />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3V13M3 8H13" {...stroke} />
    </Svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="9" height="9" rx="1.5" {...stroke} />
      <path d="M10.5 5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5" {...stroke} />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" {...stroke} />
    </Svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M1.5 8C3 5.2 5.3 3.5 8 3.5C10.7 3.5 13 5.2 14.5 8C13 10.8 10.7 12.5 8 12.5C5.3 12.5 3 10.8 1.5 8Z" {...stroke} />
      <circle cx="8" cy="8" r="2" {...stroke} />
    </Svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.4 4C6.9 3.83 7.44 3.75 8 3.75C10.7 3.75 13 5.4 14.5 8C13.94 9.05 13.27 9.93 12.5 10.62" {...stroke} />
      <path d="M10.1 10.9C9.44 11.2 8.74 11.35 8 11.35C5.3 11.35 3 9.7 1.5 8C2.28 6.65 3.22 5.6 4.3 4.9" {...stroke} />
      <path d="M2.5 2.5L13.5 13.5" {...stroke} />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" {...stroke} />
      <path d="M5.5 7V5.2C5.5 3.8 6.6 2.7 8 2.7C9.4 2.7 10.5 3.8 10.5 5.2V7" {...stroke} />
    </Svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" {...stroke} />
      <path d="M2 4.5L8 9L14 4.5" {...stroke} />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="4.2" {...stroke} />
      <path d="M10.4 10.4L13.5 13.5" {...stroke} />
    </Svg>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size} className="spinner">
      <circle cx="8" cy="8" r="6.25" {...stroke} opacity="0.3" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" {...stroke} />
    </Svg>
  );
}

export function LogoMark() {
  return (
    <div className="flex size-[var(--size-logo)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)]">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2 11L6.1 4.2L8.6 8.2L9.9 6.4L12 11H2Z" fill="var(--color-on-accent)" />
      </svg>
    </div>
  );
}
