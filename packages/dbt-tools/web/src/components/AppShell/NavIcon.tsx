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

  // Health — pulse / heartbeat signal
  if (id === "health") {
    return (
      <svg {...svgProps}>
        <polyline points="2,12 6,12 8,5 10,19 13,12 15,12 17,8 19,12 22,12" />
      </svg>
    );
  }

  // Execution — play / timeline bars
  if (id === "execution") {
    return (
      <svg {...svgProps}>
        <rect x="3" y="4" width="3" height="16" rx="1" />
        <rect x="9" y="8" width="3" height="12" rx="1" />
        <rect x="15" y="6" width="3" height="14" rx="1" />
        <rect x="21" y="10" width="0" height="0" />
        <line x1="3" y1="20" x2="21" y2="20" />
      </svg>
    );
  }

  // Quality — shield with checkmark
  if (id === "quality") {
    return (
      <svg {...svgProps}>
        <path d="M12 3l7 3v5c0 4.6-2.7 8.8-7 10-4.3-1.2-7-5.4-7-10V6l7-3z" />
        <path d="m9.2 12 2 2 3.8-4.2" />
      </svg>
    );
  }

  // Inventory — layered catalog / stack
  if (id === "inventory") {
    return (
      <svg {...svgProps}>
        <path d="M2 7l10-4 10 4-10 4-10-4z" />
        <path d="M2 12l10 4 10-4" />
        <path d="M2 17l10 4 10-4" />
      </svg>
    );
  }

  // Dependencies — graph nodes
  if (id === "dependencies") {
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

  // Search — magnifying glass
  if (id === "search") {
    return (
      <svg {...svgProps}>
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
    );
  }

  // Fallback — generic bars
  return (
    <svg {...svgProps}>
      <path d="M4 7h16" />
      <path d="M4 12h9" />
      <path d="M4 17h13" />
    </svg>
  );
}
