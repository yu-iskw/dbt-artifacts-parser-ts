import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  AssetViewState,
  InvestigationSelectionState,
  LineageViewState,
  OverviewFilterState,
  RunsViewState,
  SearchState,
  TimelineFilterState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import {
  getInitialSidebarCollapsed,
  SIDEBAR_STORAGE_KEY,
  type NavigationSelectionTarget,
} from "../components/AppShell/appNavigation";
import {
  applySearchToWorkspaceState,
  buildNextUrlFromWorkspaceState,
  createInitialNavigationState,
} from "../components/AppShell/workspaceUrlSync";

export interface UseWorkspaceUrlStateResult {
  activeView: WorkspaceView;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  overviewFilters: OverviewFilterState;
  setOverviewFilters: Dispatch<SetStateAction<OverviewFilterState>>;
  timelineFilters: TimelineFilterState;
  setTimelineFilters: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  setAssetViewState: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
  setRunsViewState: Dispatch<SetStateAction<RunsViewState>>;
  lineageViewState: LineageViewState;
  setLineageViewState: Dispatch<SetStateAction<LineageViewState>>;
  searchState: SearchState;
  setSearchState: Dispatch<SetStateAction<SearchState>>;
  investigationSelection: InvestigationSelectionState;
  setInvestigationSelection: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
  setNavigationTarget: (target: NavigationSelectionTarget) => void;
  handleNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState["activeTab"];
      rootResourceId?: string;
    },
  ) => void;
  frameClass: string;
}

export function useWorkspaceUrlState(): UseWorkspaceUrlStateResult {
  const [activeView, setActiveViewRaw] = useState<WorkspaceView>(
    () => createInitialNavigationState(window.location.search).activeView,
  );
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(
    getInitialSidebarCollapsed,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overviewFilters, setOverviewFilters] = useState<OverviewFilterState>({
    status: "all",
    resourceTypes: new Set(),
    query: "",
  });
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterState>(
    () => createInitialNavigationState(window.location.search).timelineFilters,
  );
  const [assetViewState, setAssetViewState] = useState<AssetViewState>(
    () => createInitialNavigationState(window.location.search).assetViewState,
  );
  const [runsViewState, setRunsViewState] = useState<RunsViewState>(
    () => createInitialNavigationState(window.location.search).runsViewState,
  );
  const [lineageViewState, setLineageViewState] = useState<LineageViewState>(
    () => createInitialNavigationState(window.location.search).lineageViewState,
  );
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    recentResourceIds: [],
    isOpen: false,
  });
  const [investigationSelection, setInvestigationSelection] =
    useState<InvestigationSelectionState>(
      () =>
        createInitialNavigationState(window.location.search)
          .investigationSelection,
    );

  const setSidebarCollapsed: (fn: (c: boolean) => boolean) => void =
    useCallback((fn) => {
      setSidebarCollapsedRaw((current) => {
        const next = fn(current);
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }, []);

  const setNavigationTarget = useCallback(
    (target: NavigationSelectionTarget) => {
      setActiveViewRaw(target.view === "search" ? "inventory" : target.view);
    },
    [],
  );

  const handleNavigateTo = useCallback(
    (
      view: WorkspaceView,
      options?: {
        resourceId?: string;
        executionId?: string;
        assetTab?: AssetViewState["activeTab"];
        rootResourceId?: string;
      },
    ) => {
      setActiveViewRaw(view);
      if (options?.resourceId) {
        setAssetViewState((current) => ({
          ...current,
          selectedResourceId: options.resourceId ?? current.selectedResourceId,
          activeTab: options.assetTab ?? current.activeTab,
        }));
        setLineageViewState((current) => ({
          ...current,
          rootResourceId:
            options.rootResourceId ??
            options.resourceId ??
            current.rootResourceId,
          selectedResourceId: options.resourceId ?? current.selectedResourceId,
        }));
      } else if (options?.assetTab && view === "inventory") {
        setAssetViewState((current) => ({
          ...current,
          activeTab: options.assetTab ?? current.activeTab,
        }));
      }
      if (options?.executionId) {
        setRunsViewState((current) => ({
          ...current,
          selectedExecutionId:
            options.executionId ?? current.selectedExecutionId,
        }));
        setTimelineFilters((current) => ({
          ...current,
          selectedExecutionId:
            options.executionId ?? current.selectedExecutionId,
        }));
      }
      if (view === "runs" && options?.resourceId) {
        setRunsViewState((current) => ({
          ...current,
          query: options.resourceId ?? current.query,
        }));
      }
      setInvestigationSelection((current) => ({
        selectedResourceId: options?.resourceId ?? current.selectedResourceId,
        selectedExecutionId:
          options?.executionId ?? current.selectedExecutionId,
        sourceLens: view,
      }));
    },
    [],
  );

  useEffect(() => {
    const nextUrl = buildNextUrlFromWorkspaceState({
      pathname: window.location.pathname,
      hash: window.location.hash,
      activeView,
      assetViewState,
      runsViewState,
      timelineSelectedExecutionId: timelineFilters.selectedExecutionId,
      lineageViewState,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, "", nextUrl);
    }
  }, [
    activeView,
    assetViewState,
    runsViewState,
    timelineFilters.selectedExecutionId,
    lineageViewState,
  ]);

  useEffect(() => {
    const onPopState = () => {
      const r = applySearchToWorkspaceState(window.location.search);
      if (r.activeView !== undefined) {
        setActiveViewRaw(r.activeView);
      }
      setAssetViewState((c) => r.assetViewState(c));
      setRunsViewState((c) => r.runsViewState(c));
      setTimelineFilters((c) => r.timelineFilters(c));
      setLineageViewState(r.lineageViewState);
      setInvestigationSelection((c) => r.investigationSelection(c));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchState((current) => ({ ...current, isOpen: true }));
      }
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setSearchState((current) => ({ ...current, isOpen: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const frameClass = [
    "app-frame",
    sidebarCollapsed ? "app-frame--sidebar-collapsed" : "",
    sidebarOpen ? "app-frame--nav-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    activeView,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
    overviewFilters,
    setOverviewFilters,
    timelineFilters,
    setTimelineFilters,
    assetViewState,
    setAssetViewState,
    runsViewState,
    setRunsViewState,
    lineageViewState,
    setLineageViewState,
    searchState,
    setSearchState,
    investigationSelection,
    setInvestigationSelection,
    setNavigationTarget,
    handleNavigateTo,
    frameClass,
  };
}
