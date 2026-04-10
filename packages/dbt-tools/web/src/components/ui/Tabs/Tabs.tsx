import {
  createContext,
  useContext,
  useCallback,
  useState,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import "./Tabs.css";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx)
    throw new Error("Tabs compound components must be used within <Tabs>");
  return ctx;
}

interface TabsProps {
  /** The id of the initially active tab. */
  defaultTab: string;
  /** Controlled active tab (optional). */
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: ReactNode;
}

export function Tabs({
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  children,
}: TabsProps) {
  const [uncontrolledTab, setUncontrolledTab] = useState(defaultTab);
  const baseId = useId();

  const activeTab = controlledTab ?? uncontrolledTab;
  const setActiveTab = useCallback(
    (id: string) => {
      if (!controlledTab) setUncontrolledTab(id);
      onTabChange?.(id);
    },
    [controlledTab, onTabChange],
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      {children}
    </TabsContext.Provider>
  );
}

interface TabListProps {
  /** "underline" (default) or "pill" for a segmented-control look. */
  variant?: "underline" | "pill";
  label: string;
  children: ReactNode;
  className?: string;
}

function TabList({
  variant = "underline",
  label,
  className,
  children,
}: TabListProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const current = tabs.findIndex((t) => t === document.activeElement);
    let next = current;

    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;

    e.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  }, []);

  const cls = [
    "ui-tablist",
    variant === "pill" && "ui-tablist--pill",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // WAI-ARIA tablist pattern: focus lives on individual tab buttons, not the container.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="tablist"
      aria-label={label}
      className={cls}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

interface TabProps {
  id: string;
  children: ReactNode;
  className?: string;
}

function Tab({ id, className, children }: TabProps) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const selected = activeTab === id;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${id}`}
      tabIndex={selected ? 0 : -1}
      className={["ui-tab", className].filter(Boolean).join(" ")}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

function TabPanel({ id, className, children }: TabPanelProps) {
  const { activeTab, baseId } = useTabsContext();
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      tabIndex={0}
      className={["ui-tabpanel", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
