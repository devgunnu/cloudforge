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
import { runMockDeploy, type DeployStatus } from '@/lib/mockDeploy';

export type { DeployStatus };

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
  startDeploy: () => Promise<void>;
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

  startDeploy: async () => {
    const { getTopology, deployStatus } = get();
    if (deployStatus !== 'idle' && deployStatus !== 'error') return;

    const topology = getTopology();

    set({ deployStatus: 'generating', deployLog: [], deployError: null });

    try {
      for await (const event of runMockDeploy()) {
        set((state) => ({
          deployStatus: event.status,
          deployLog: event.logLine
            ? [...state.deployLog, event.logLine]
            : state.deployLog,
        }));

        // ============================================================
        // BACKEND HOOK: POST /api/deploy
        // Payload: CloudForgeTopology (see src/types/topology.ts)
        // Expected response: { deploymentId: string, status: string }
        // The backend agent (Claude + AWS Cloud Control API) receives
        // this topology and generates + executes Terraform.
        // ============================================================
        if (
          event.status === 'deploying' &&
          event.logLine?.includes('provisioning agent')
        ) {
          await fetch('/api/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(topology),
          }).catch(() => {
            // Mock: swallow fetch errors during demo
          });
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown deploy error';
      set({ deployStatus: 'error', deployError: message });
      return;
    }

    // Auto-reset to idle after 4s on success
    setTimeout(() => {
      set((state) => {
        if (state.deployStatus === 'live') {
          return { deployStatus: 'idle' };
        }
        return {};
      });
    }, 4000);
  },

  resetDeploy: () =>
    set({ deployStatus: 'idle', deployLog: [], deployError: null }),

  getTopology: () => {
    const { nodes, edges } = get();
    return exportTopology(nodes, edges);
  },

  showTopologyPreview: false,
  toggleTopologyPreview: () =>
    set((state) => ({ showTopologyPreview: !state.showTopologyPreview })),
}));
