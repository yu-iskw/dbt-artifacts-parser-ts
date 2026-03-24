import type { SidebarNavigationTarget } from "./appNavigation";

export function NavIcon({ id }: { id: SidebarNavigationTarget["id"] }) {
  const svgProps = {
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: "1.8" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 20,
    height: 20,
    "aria-hidden": true as const,
  };

  if (id === "overview") {
    return (
      <svg {...svgProps}>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      </svg>
    );
  }

  if (id === "assets") {
    return (
      <svg {...svgProps}>
        <circle cx="5.5" cy="6.5" r="2" />
        <circle cx="5.5" cy="17.5" r="2" />
        <circle cx="18.5" cy="12" r="2" />
        <path d="M7.5 6.5 Q13 6.5 16.5 12" />
        <path d="M7.5 17.5 Q13 17.5 16.5 12" />
      </svg>
    );
  }

  if (id === "models") {
    return (
      <svg {...svgProps}>
        <path d="M2 7l10-4 10 4-10 4-10-4z" />
        <path d="M2 12l10 4 10-4" />
        <path d="M2 17l10 4 10-4" />
      </svg>
    );
  }

  if (id === "tests") {
    return (
      <svg {...svgProps}>
        <path d="M12 3l7 3v5c0 4.6-2.7 8.8-7 10-4.3-1.2-7-5.4-7-10V6l7-3z" />
        <path d="m9.2 12 2 2 3.8-4.2" />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <path d="M4 7h16" />
      <path d="M4 12h9" />
      <path d="M4 17h13" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}
