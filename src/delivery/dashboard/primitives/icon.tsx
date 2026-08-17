import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.5 } as const;

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

export function IconPlus(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" {...stroke} />
      <path d="M9.5 4.5V3C9.5 2.2 8.8 1.5 8 1.5H3C2.2 1.5 1.5 2.2 1.5 3V8C1.5 8.8 2.2 9.5 3 9.5H4.5" {...stroke} />
    </svg>
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

export function IconLock(props: IconProps) {
  return (
    <Svg size={14} {...props}>
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" {...stroke} />
      <path d="M5.5 7V5.2C5.5 3.8 6.6 2.7 8 2.7C9.4 2.7 10.5 3.8 10.5 5.2V7" {...stroke} />
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

export function LogoMark() {
  return (
    <div className="flex size-[var(--size-logo)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)]">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2 11L6.1 4.2L8.6 8.2L9.9 6.4L12 11H2Z" fill="var(--color-on-accent)" />
      </svg>
    </div>
  );
}
