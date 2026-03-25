import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const DATA_THEME_ATTR = "data-theme";
const THEME_DARK = "dark" as const;

/** Read the current app theme from the document root (for tests and non-React callers). */
export function readDocumentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const v = document.documentElement.getAttribute(DATA_THEME_ATTR);
  return v === THEME_DARK ? THEME_DARK : "light";
}

/** Subscribe to `data-theme` changes on `document.documentElement`. */
export function subscribeDocumentTheme(
  onChange: (theme: Theme) => void,
): () => void {
  onChange(readDocumentTheme());
  const observer = new MutationObserver(() => onChange(readDocumentTheme()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [DATA_THEME_ATTR],
  });
  return () => observer.disconnect();
}

/**
 * Follows `data-theme` on `document.documentElement` (including updates from
 * {@link useTheme} elsewhere). Use in deep children that need theme-aware
 * colors without duplicating theme state.
 */
export function useSyncedDocumentTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => readDocumentTheme());

  useEffect(() => {
    setTheme(readDocumentTheme());
    return subscribeDocumentTheme(setTheme);
  }, []);

  return theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = window.localStorage.getItem("dbt-tools.theme");
      if (stored === "light" || stored === THEME_DARK) return stored as Theme;
      if (window.matchMedia("(prefers-color-scheme: dark)").matches)
        return THEME_DARK;
    } catch {
      // ignore
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute(DATA_THEME_ATTR, theme);
    try {
      window.localStorage.setItem("dbt-tools.theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? THEME_DARK : "light"));

  return { theme, toggleTheme };
}
