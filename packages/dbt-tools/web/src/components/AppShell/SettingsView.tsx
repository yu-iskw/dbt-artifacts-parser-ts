import type { Dispatch, SetStateAction } from "react";
import { DsButton } from "@web/design-system";
import type { ThemePreference } from "@web/lib/analysis-workspace/types";
import { sourceLabel } from "@web/lib/artifactSource";
import type {
  RemoteArtifactRun,
  WorkspaceArtifactSource,
} from "@web/services/artifactSourceApi";
import { SectionCard, WorkspaceScaffold } from "../AnalysisWorkspace/shared";
import type { WorkspacePreferences } from "@web/hooks/useWorkspacePreferences";

const ACTIVE_PILL_CLASS = "workspace-pill workspace-pill--active";
const INACTIVE_PILL_CLASS = "workspace-pill";

function pillClass(active: boolean) {
  return active ? ACTIVE_PILL_CLASS : INACTIVE_PILL_CLASS;
}

function SettingsHero({
  analysisSource,
  executionCount,
}: {
  analysisSource: WorkspaceArtifactSource | null;
  executionCount: number | null;
}) {
  return (
    <section className="settings-hero" aria-label="Workspace preferences">
      <p className="eyebrow">Workspace profile</p>
      <h3>Configure how this console looks and behaves by default.</h3>
      <p>
        Changes save locally and apply to the current workspace immediately when
        the relevant view is open.
      </p>
      <div className="settings-chip-row">
        <span className="app-badge">{sourceLabel(analysisSource)}</span>
        <span className="settings-chip">
          {executionCount != null
            ? `${executionCount} executions loaded`
            : "No artifacts loaded"}
        </span>
      </div>
    </section>
  );
}

function AppearanceSettings({
  themePreference,
  onThemeChange,
}: {
  themePreference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
}) {
  return (
    <SectionCard
      title="Appearance"
      subtitle="Choose how the workspace chrome should render by default."
    >
      <div className="settings-field-group">
        <span className="settings-field-label">Theme</span>
        <div className="settings-segmented">
          {(["system", "light", "dark"] as const).map((value) => (
            <DsButton
              key={value}
              variant="ghost"
              type="button"
              className={pillClass(themePreference === value)}
              onClick={() => onThemeChange(value)}
            >
              {value === "system"
                ? "System"
                : value.charAt(0).toUpperCase() + value.slice(1)}
            </DsButton>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function SessionSettings({
  analysisSource,
  executionCount,
  onLoadDifferent,
  pendingRemoteRun,
  acceptingRemoteRun,
  onAcceptPendingRemoteRun,
}: {
  analysisSource: WorkspaceArtifactSource | null;
  executionCount: number | null;
  onLoadDifferent: () => void;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onAcceptPendingRemoteRun: () => Promise<void>;
}) {
  return (
    <SectionCard
      title="Session"
      subtitle="Current artifact source and data-loading controls."
    >
      <div className="settings-stack">
        <div className="settings-readout">
          <span className="settings-field-label">Current source</span>
          <strong>{sourceLabel(analysisSource)}</strong>
          <p>
            {executionCount != null
              ? `${executionCount} executions are available in this session.`
              : "Load artifacts to unlock analysis views."}
          </p>
        </div>
        <DsButton
          variant="primary"
          type="button"
          className="primary-action settings-primary-action"
          onClick={onLoadDifferent}
        >
          Load different artifacts
        </DsButton>
        {pendingRemoteRun && (
          <DsButton
            variant="secondary"
            type="button"
            className="workspace-pill"
            onClick={() => void onAcceptPendingRemoteRun()}
            disabled={acceptingRemoteRun}
          >
            {acceptingRemoteRun
              ? "Switching…"
              : `Load ${pendingRemoteRun.label}`}
          </DsButton>
        )}
      </div>
    </SectionCard>
  );
}

function ShellDefaultsSettings({
  preferences,
  setPreferences,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  return (
    <SectionCard
      title="Shell Defaults"
      subtitle="Control the default shape of the workspace chrome."
    >
      <div className="settings-field-group">
        <span className="settings-field-label">Sidebar</span>
        <div className="settings-segmented">
          <DsButton
            variant="ghost"
            type="button"
            className={pillClass(!preferences.sidebarCollapsedDefault)}
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                sidebarCollapsedDefault: false,
              }))
            }
          >
            Expanded
          </DsButton>
          <DsButton
            variant="ghost"
            type="button"
            className={pillClass(preferences.sidebarCollapsedDefault)}
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                sidebarCollapsedDefault: true,
              }))
            }
          >
            Collapsed
          </DsButton>
        </div>
      </div>
    </SectionCard>
  );
}

function TimelineDefaultsSettings({
  preferences,
  setPreferences,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  return (
    <SectionCard
      title="Timeline Defaults"
      subtitle="Set the default execution timeline filters and dependency focus."
    >
      <div className="settings-stack">
        <div className="settings-inline-grid">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={preferences.timelineDefaults.showTests}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    showTests: event.target.checked,
                  },
                }))
              }
            />
            <span>Show tests by default</span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={preferences.timelineDefaults.failuresOnly}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    failuresOnly: event.target.checked,
                  },
                }))
              }
            />
            <span>Start with failures-only emphasis</span>
          </label>
        </div>
        <div className="settings-inline-grid">
          <label className="settings-field">
            <span className="settings-field-label">Dependency direction</span>
            <select
              value={preferences.timelineDefaults.dependencyDirection}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    dependencyDirection: event.target
                      .value as WorkspacePreferences["timelineDefaults"]["dependencyDirection"],
                  },
                }))
              }
            >
              <option value="upstream">Upstream</option>
              <option value="both">Both</option>
              <option value="downstream">Downstream</option>
            </select>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Dependency depth</span>
            <input
              type="number"
              min="1"
              max="10"
              value={preferences.timelineDefaults.dependencyDepthHops}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timelineDefaults: {
                    ...current.timelineDefaults,
                    dependencyDepthHops: Math.max(
                      1,
                      Math.min(10, Number(event.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
        </div>
      </div>
    </SectionCard>
  );
}

function InventoryDefaultsSettings({
  preferences,
  setPreferences,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
}) {
  return (
    <SectionCard
      title="Inventory Defaults"
      subtitle="Choose how asset exploration and lineage open by default."
    >
      <div className="settings-stack">
        <div className="settings-inline-grid">
          <label className="settings-field">
            <span className="settings-field-label">Explorer mode</span>
            <select
              value={preferences.inventoryDefaults.explorerMode}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    explorerMode: event.target
                      .value as WorkspacePreferences["inventoryDefaults"]["explorerMode"],
                  },
                }))
              }
            >
              <option value="project">Project</option>
              <option value="database">Database</option>
            </select>
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Lineage lens</span>
            <select
              value={preferences.inventoryDefaults.lineageLensMode}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    lineageLensMode: event.target
                      .value as WorkspacePreferences["inventoryDefaults"]["lineageLensMode"],
                  },
                }))
              }
            >
              <option value="type">Type</option>
              <option value="status">Status</option>
              <option value="coverage">Coverage</option>
            </select>
          </label>
        </div>
        <div className="settings-inline-grid">
          <label className="settings-field">
            <span className="settings-field-label">Upstream depth</span>
            <input
              type="number"
              min="1"
              max="10"
              value={preferences.inventoryDefaults.lineageUpstreamDepth}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    lineageUpstreamDepth: Math.max(
                      1,
                      Math.min(10, Number(event.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Downstream depth</span>
            <input
              type="number"
              min="1"
              max="10"
              value={preferences.inventoryDefaults.lineageDownstreamDepth}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  inventoryDefaults: {
                    ...current.inventoryDefaults,
                    lineageDownstreamDepth: Math.max(
                      1,
                      Math.min(10, Number(event.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={preferences.inventoryDefaults.allDepsMode}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                inventoryDefaults: {
                  ...current.inventoryDefaults,
                  allDepsMode: event.target.checked,
                },
              }))
            }
          />
          <span>Open lineage with all dependencies expanded</span>
        </label>
      </div>
    </SectionCard>
  );
}

export function SettingsView({
  preferences,
  setPreferences,
  themePreference,
  setThemePreference,
  analysisSource,
  executionCount,
  onLoadDifferent,
  pendingRemoteRun,
  acceptingRemoteRun,
  onAcceptPendingRemoteRun,
}: {
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  themePreference: ThemePreference;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
  analysisSource: WorkspaceArtifactSource | null;
  executionCount: number | null;
  onLoadDifferent: () => void;
  pendingRemoteRun: RemoteArtifactRun | null;
  acceptingRemoteRun: boolean;
  onAcceptPendingRemoteRun: () => Promise<void>;
}) {
  const updateThemePreference = (value: ThemePreference) => {
    setThemePreference(value);
    setPreferences((current) => ({ ...current, theme: value }));
  };

  return (
    <WorkspaceScaffold
      title="Settings"
      description="Workspace defaults, visual preferences, and session controls."
      className="settings-view"
    >
      <div className="settings-grid">
        <SettingsHero
          analysisSource={analysisSource}
          executionCount={executionCount}
        />
        <AppearanceSettings
          themePreference={themePreference}
          onThemeChange={updateThemePreference}
        />
        <SessionSettings
          analysisSource={analysisSource}
          executionCount={executionCount}
          onLoadDifferent={onLoadDifferent}
          pendingRemoteRun={pendingRemoteRun}
          acceptingRemoteRun={acceptingRemoteRun}
          onAcceptPendingRemoteRun={onAcceptPendingRemoteRun}
        />
        <ShellDefaultsSettings
          preferences={preferences}
          setPreferences={setPreferences}
        />
        <TimelineDefaultsSettings
          preferences={preferences}
          setPreferences={setPreferences}
        />
        <InventoryDefaultsSettings
          preferences={preferences}
          setPreferences={setPreferences}
        />
      </div>
    </WorkspaceScaffold>
  );
}
