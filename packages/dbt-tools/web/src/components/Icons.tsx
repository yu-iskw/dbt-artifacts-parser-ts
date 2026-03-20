/**
 * Inline SVG icon library — no external dependencies.
 * All icons use `currentColor` so they inherit text color.
 * Default size: 20×20 viewBox.
 */

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}

function Icon({
  size = 20,
  className,
  style,
  "aria-hidden": ariaHidden = true,
  children,
  viewBox = "0 0 20 20",
}: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden={ariaHidden}
    >
      {children}
    </svg>
  );
}

// ─── Navigation icons ─────────────────────────────────────────────────────────

export function OverviewIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect
        x="2"
        y="2"
        width="7"
        height="7"
        rx="1.5"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="11"
        y="2"
        width="7"
        height="7"
        rx="1.5"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="2"
        y="11"
        width="7"
        height="7"
        rx="1.5"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="11"
        y="11"
        width="7"
        height="7"
        rx="1.5"
        fill="currentColor"
        opacity="0.85"
      />
    </Icon>
  );
}

export function AssetsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect
        x="2"
        y="14"
        width="16"
        height="4"
        rx="1.5"
        fill="currentColor"
        opacity="0.6"
      />
      <rect
        x="2"
        y="8"
        width="16"
        height="4"
        rx="1.5"
        fill="currentColor"
        opacity="0.8"
      />
      <rect x="2" y="2" width="16" height="4" rx="1.5" fill="currentColor" />
    </Icon>
  );
}

export function ModelsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="10" cy="5" rx="8" ry="3" fill="currentColor" opacity="0.7" />
      <path
        d="M2 5v5c0 1.657 3.582 3 8 3s8-1.343 8-3V5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M2 10v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
    </Icon>
  );
}

export function TestsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M10 1.5L12.5 4H17.5L10 18.5L2.5 4H7.5L10 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M7 8.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function TimelineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="4" width="10" height="3" rx="1.5" fill="currentColor" />
      <rect
        x="2"
        y="9"
        width="14"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.75"
      />
      <rect
        x="5"
        y="14"
        width="8"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.55"
      />
    </Icon>
  );
}

// ─── Resource type icons ───────────────────────────────────────────────────────

export function ModelIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <rect
        x="1"
        y="4"
        width="14"
        height="2.5"
        rx="1"
        fill="currentColor"
        opacity="0.7"
      />
      <rect
        x="1"
        y="8"
        width="14"
        height="2.5"
        rx="1"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="1"
        y="12"
        width="14"
        height="2.5"
        rx="1"
        fill="currentColor"
        opacity="0.55"
      />
    </Icon>
  );
}

export function TestIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <path
        d="M3 3h10v7l-5 4-5-4V3z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M5.5 7l1.5 1.5 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function SeedIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <path
        d="M8 14V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 8C8 5 5 3 2 3c0 4 2 6 6 6z"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M8 8C8 5 11 3 14 3c0 4-2 6-6 6z"
        fill="currentColor"
        opacity="0.55"
      />
    </Icon>
  );
}

export function SnapshotIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <path
        d="M8 4v4l3 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function SourceIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <ellipse
        cx="8"
        cy="5"
        rx="6"
        ry="2.5"
        fill="currentColor"
        opacity="0.65"
      />
      <path
        d="M2 5v6c0 1.38 2.686 2.5 6 2.5s6-1.12 6-2.5V5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
    </Icon>
  );
}

export function ExposureIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
      <path
        d="M8 1C4 1 1 4.5 1 8s3 7 7 7 7-3.5 7-7-3-7-7-7z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M1 8h2M13 8h2M8 1v2M8 13v2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </Icon>
  );
}

export function MetricIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <path
        d="M2 12l3.5-4 3 2.5 3-5 2.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="5.5" cy="8" r="1.2" fill="currentColor" opacity="0.7" />
      <circle cx="8.5" cy="10.5" r="1.2" fill="currentColor" opacity="0.7" />
      <circle cx="11.5" cy="5.5" r="1.2" fill="currentColor" opacity="0.7" />
    </Icon>
  );
}

export function SemanticModelIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <circle cx="4" cy="4" r="2" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="4" r="2" fill="currentColor" opacity="0.75" />
      <circle cx="8" cy="12" r="2" fill="currentColor" opacity="0.9" />
      <line
        x1="4"
        y1="4"
        x2="12"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      <line
        x1="4"
        y1="4"
        x2="8"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      <line
        x1="12"
        y1="4"
        x2="8"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
    </Icon>
  );
}

export function UnitTestIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <path
        d="M5 2h6l2 4-5 8-5-8 2-4z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M6 6l1.5 1.5 3-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function AnalysisIcon(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 16 16">
      <path
        d="M2 13L6 8l3 3 3-5 2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

// ─── UI / action icons ─────────────────────────────────────────────────────────

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M10 13V7M10 7l-3 3M10 7l3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 14h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
    </Icon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M5 2h7l4 4v12H4V2h1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 2v4h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M7 10h6M7 13h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle
        cx="9"
        cy="9"
        r="6"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M13.5 13.5L18 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M13 4l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M15 12.5A7 7 0 017.5 5a7 7 0 100 10 7 7 0 007.5-2.5z"
        fill="currentColor"
        opacity="0.85"
      />
    </Icon>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M6.5 10l2.5 2.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

/** Map a dbt resource type string to its icon component. */
export function ResourceTypeIcon({
  resourceType,
  ...props
}: IconProps & { resourceType: string }) {
  switch (resourceType) {
    case "model":
      return <ModelIcon {...props} />;
    case "test":
      return <TestIcon {...props} />;
    case "seed":
      return <SeedIcon {...props} />;
    case "snapshot":
      return <SnapshotIcon {...props} />;
    case "source":
      return <SourceIcon {...props} />;
    case "exposure":
      return <ExposureIcon {...props} />;
    case "metric":
      return <MetricIcon {...props} />;
    case "semantic_model":
      return <SemanticModelIcon {...props} />;
    case "unit_test":
      return <UnitTestIcon {...props} />;
    case "analysis":
      return <AnalysisIcon {...props} />;
    default:
      return <ModelIcon {...props} />;
  }
}
