import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ForgeStage = 'requirements' | 'architecture' | 'build' | 'deploy';
export type StageStatus = 'locked' | 'processing' | 'done';

export interface ConstraintChip {
  id: string;
  label: string;
  category: 'performance' | 'security' | 'cost' | 'reliability';
}

export interface ActivityCard {
  status: 'done' | 'processing';
  label: string;
  files: Array<{ id: string; name: string; status: 'new' | 'modified' | 'pending' }>;
}

export interface ForgeChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  chips?: ConstraintChip[];
  activityCard?: ActivityCard;
}

export interface ForgeArchNode {
  id: string;
  label: string;
  sublabel: string;
  type: 'compute' | 'storage' | 'cache' | 'gateway' | 'queue' | 'auth';
  x: number;
  y: number;
  terraformResource: string;
  estimatedCost: string;
  config: Record<string, string>;
  whyChosen: string;
  validates: string[];
  blocks: string[];
  deployStatus: 'queued' | 'provisioning' | 'live';
}

export interface ForgeArchEdge {
  from: string;
  to: string;
}

export interface GeneratedFile {
  id: string;
  name: string;
  path: string;
  lang: string;
  status: 'new' | 'modified' | 'pending';
  nodeId?: string;
  lines: Array<{ content: string }>;
}

// ── Store interface ───────────────────────────────────────────────────────────

interface ForgeState {
  activeStage: ForgeStage;
  stageStatus: Record<ForgeStage, StageStatus>;
  projectName: string;
  prdText: string;
  constraints: ConstraintChip[];
  architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] } | null;
  generatedFiles: Record<string, GeneratedFile>;
  openFiles: string[];
  activeFile: string | null;
  chatHistory: Record<ForgeStage, ForgeChatMessage[]>;
  buildProgress: number;
  buildTotal: number;
  deployLog: string[];
  deployModalOpen: boolean;
  currentProjectId: string | null;

  // Actions
  setStageStatus: (stage: ForgeStage, status: StageStatus) => void;
  advanceStage: () => void;
  navigateToStage: (stage: ForgeStage) => void;
  setPrdText: (text: string) => void;
  setConstraints: (chips: ConstraintChip[]) => void;
  setArchitectureData: (data: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] }) => void;
  addGeneratedFile: (file: GeneratedFile) => void;
  updateFileStatus: (id: string, status: GeneratedFile['status']) => void;
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  addChatMessage: (stage: ForgeStage, message: ForgeChatMessage) => void;
  setBuildProgress: (pct: number, total?: number) => void;
  addDeployLog: (line: string) => void;
  updateNodeDeployStatus: (nodeId: string, status: ForgeArchNode['deployStatus']) => void;
  setProjectName: (name: string) => void;
  setDeployModalOpen: (open: boolean) => void;
  setCurrentProjectId: (id: string | null) => void;
}

// ── Stage order ───────────────────────────────────────────────────────────────

export const FORGE_STAGE_ORDER: ForgeStage[] = [
  'requirements',
  'architecture',
  'build',
  'deploy',
];

export const FORGE_STAGE_LABELS: Record<ForgeStage, string> = {
  requirements: 'Requirements',
  architecture: 'Architecture',
  build: 'Build',
  deploy: 'Deploy',
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useForgeStore = create<ForgeState>((set, get) => ({
  activeStage: 'requirements',
  stageStatus: {
    requirements: 'processing',
    architecture: 'locked',
    build: 'locked',
    deploy: 'locked',
  },
  projectName: 'auth-service-api',
  prdText:
    'Build a JWT authentication microservice with rate limiting, refresh tokens, and audit logging. Must support PostgreSQL for user storage and Redis for session caching. Target: 10k concurrent users, P95 latency < 200ms.',
  constraints: [],
  architectureData: null,
  generatedFiles: {},
  openFiles: [],
  activeFile: null,
  chatHistory: {
    requirements: [{
      id: 'init-req',
      role: 'agent' as const,
      content: "Describe your product and I'll extract the NFR constraints.",
    }],
    architecture: [{
      id: 'init-arch',
      role: 'agent' as const,
      content: 'Constraints extracted. Generating AWS architecture now.',
    }],
    build: [{
      id: 'init-build',
      role: 'agent' as const,
      content: 'Architecture validated. Generating Terraform + application code.',
    }],
    deploy: [{
      id: 'init-deploy',
      role: 'agent' as const,
      content: 'Architecture locked. Beginning infrastructure provisioning.',
    }],
  },
  buildProgress: 0,
  buildTotal: 5,
  deployLog: [],
  deployModalOpen: false,
  currentProjectId: null,

  setStageStatus: (stage, status) =>
    set((state) => ({
      stageStatus: { ...state.stageStatus, [stage]: status },
    })),

  advanceStage: () => {
    const { activeStage, stageStatus } = get();
    if (stageStatus[activeStage] !== 'done') return;
    const idx = FORGE_STAGE_ORDER.indexOf(activeStage);
    if (idx >= FORGE_STAGE_ORDER.length - 1) return;
    const next = FORGE_STAGE_ORDER[idx + 1];
    set((state) => ({
      activeStage: next,
      stageStatus: { ...state.stageStatus, [next]: 'processing' },
    }));
  },

  navigateToStage: (stage) => {
    const { stageStatus } = get();
    if (stageStatus[stage] === 'locked') return;
    set({ activeStage: stage });
  },

  setPrdText: (text) => set({ prdText: text }),

  setConstraints: (chips) => set({ constraints: chips }),

  setArchitectureData: (data) => set({ architectureData: data }),

  addGeneratedFile: (file) =>
    set((state) => ({
      generatedFiles: { ...state.generatedFiles, [file.id]: file },
    })),

  updateFileStatus: (id, status) =>
    set((state) => {
      const existing = state.generatedFiles[id];
      if (!existing) return state;
      return {
        generatedFiles: {
          ...state.generatedFiles,
          [id]: { ...existing, status },
        },
      };
    }),

  openFile: (id) =>
    set((state) => {
      if (state.openFiles.includes(id)) return { activeFile: id };
      const trimmed =
        state.openFiles.length >= 4
          ? state.openFiles.slice(1)
          : state.openFiles;
      return { openFiles: [...trimmed, id], activeFile: id };
    }),

  closeFile: (id) =>
    set((state) => {
      const newOpen = state.openFiles.filter((f) => f !== id);
      const newActive =
        state.activeFile === id
          ? (newOpen[newOpen.length - 1] ?? null)
          : state.activeFile;
      return { openFiles: newOpen, activeFile: newActive };
    }),

  addChatMessage: (stage, message) =>
    set((state) => ({
      chatHistory: {
        ...state.chatHistory,
        [stage]: [...state.chatHistory[stage], message],
      },
    })),

  setBuildProgress: (pct, total) =>
    set((state) => ({
      buildProgress: pct,
      buildTotal: total ?? state.buildTotal,
    })),

  addDeployLog: (line) =>
    set((state) => ({ deployLog: [...state.deployLog, line] })),

  updateNodeDeployStatus: (nodeId, status) =>
    set((state) => {
      if (!state.architectureData) return state;
      return {
        architectureData: {
          ...state.architectureData,
          nodes: state.architectureData.nodes.map((n) =>
            n.id === nodeId ? { ...n, deployStatus: status } : n
          ),
        },
      };
    }),

  setProjectName: (name) => set({ projectName: name }),

  setDeployModalOpen: (open) => set({ deployModalOpen: open }),

  setCurrentProjectId: (id) => set({ currentProjectId: id }),
}));
