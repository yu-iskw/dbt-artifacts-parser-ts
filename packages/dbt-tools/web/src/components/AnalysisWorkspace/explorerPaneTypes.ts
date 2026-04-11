import type { MaterializationKind, ResourceNode } from "@web/types";
import type {
  AssetExplorerMode,
  DashboardStatusFilter,
} from "@web/lib/workspace-state/types";
import type { ExplorerTreeRow } from "@web/lib/workspace-state/explorerTree";

export interface ExplorerPaneProps {
  treeRows: ExplorerTreeRow[];
  filteredResources: ResourceNode[];
  totalResources: number;
  matchedResources: number;
  explorerMode: AssetExplorerMode;
  setExplorerMode: (value: AssetExplorerMode) => void;
  status: DashboardStatusFilter;
  setStatus: (value: DashboardStatusFilter) => void;
  availableResourceTypes: string[];
  activeResourceTypes: Set<string>;
  toggleResourceType: (value: string) => void;
  availableMaterializationKinds: MaterializationKind[];
  activeMaterializationKinds: Set<MaterializationKind>;
  toggleMaterializationKind: (value: MaterializationKind) => void;
  resourceQuery: string;
  setResourceQuery: (value: string) => void;
  selectedResourceId: string | null;
  expandedNodeIds: Set<string>;
  toggleExpandedNode: (id: string) => void;
  setSelectedResourceId: (id: string | null) => void;
}
