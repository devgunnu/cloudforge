import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import type { CloudForgeTopology } from '@/types/topology';
import { exportTopology } from '@/lib/exportTopology';
import { runDeploy } from '@/lib/forge-agents';

export type DeployStatus = 'idle' | 'generating' | 'deploying' | 'live' | 'error';

export interface NodeData {
  serviceId: string;
  label: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

interface CanvasStore {
  // React Flow state
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Selection
  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;

  // Node operations
  addNode: (node: Node) => void;
  deleteNode: (id: string) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  updateNodeLabel: (id: string, label: string) => void;

  // Deploy state machine
  deployStatus: DeployStatus;
  deployLog: string[];
  deployError: string | null;
  deployRunId: number;
  startDeploy: (projectId: string) => Promise<void>;
  resetDeploy: () => void;

  // Topology export
  getTopology: () => CloudForgeTopology;

  // UI
  showTopologyPreview: boolean;
  toggleTopologyPreview: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--cf-cyan)',
          },
          style: {
            stroke: 'var(--cf-cyan)',
            strokeWidth: 1.5,
            opacity: 0.5,
          },
        },
        state.edges
      ),
    }));
  },

  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  updateNodeConfig: (id, config) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                config: {
                  ...(node.data as NodeData).config,
                  ...config,
                },
              },
            }
          : node
      ),
    })),

  updateNodeLabel: (id, label) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node
      ),
    })),

  deployStatus: 'idle',
  deployLog: [],
  deployError: null,
  deployRunId: 0,

  startDeploy: async (projectId: string) => {
    const { deployStatus } = get();
    if (deployStatus !== 'idle' && deployStatus !== 'error') return;

    const runId = get().deployRunId + 1;
    set({ deployStatus: 'generating', deployLog: [], deployError: null, deployRunId: runId });

    try {
      await runDeploy(
        [],
        { nodes: [], edges: [] },
        {
          onLog: (line: string) => {
            set((state) => ({ deployLog: [...state.deployLog, line] }));
          },
          onNodeStatus: (_nodeId: string, status: string) => {
            if (status === 'provisioning') {
              set({ deployStatus: 'deploying' });
            } else if (status === 'live') {
              set({ deployStatus: 'live' });
            }
          },
        },
        projectId,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown deploy error';
      set({ deployStatus: 'error', deployError: message });
      return;
    }

    set({ deployStatus: 'live' });

    // Auto-reset to idle after 4s on success — guard against stale timers from prior deploys
    const capturedRunId = runId;
    setTimeout(() => {
      set((state) => {
        if (state.deployStatus === 'live' && state.deployRunId === capturedRunId) {
          return { deployStatus: 'idle' };
        }
        return {};
      });
    }, 4000);
  },

  resetDeploy: () =>
    set((state) => ({ deployStatus: 'idle', deployLog: [], deployError: null, deployRunId: state.deployRunId + 1 })),

  getTopology: () => {
    const { nodes, edges } = get();
    return exportTopology(nodes, edges);
  },

  showTopologyPreview: false,
  toggleTopologyPreview: () =>
    set((state) => ({ showTopologyPreview: !state.showTopologyPreview })),
}));
