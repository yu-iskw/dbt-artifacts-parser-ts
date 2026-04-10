interface SpinnerProps {
  /** Diameter in pixels. Default: 24. */
  size?: number;
  /** Optional accessible label. Default: omitted (decorative). */
  label?: string;
}

export function Spinner({ size = 24, label }: SpinnerProps) {
  return (
    <svg
      className="spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--border-default)"
        strokeWidth="2.5"
      />
      <path
        d="M12 2 A10 10 0 0 1 22 12"
        stroke="var(--accent-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
