import { create } from 'zustand';
import { authHeaders, getProjectFiles, getFileContent, saveFileContent } from '@/lib/forge-agents';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export interface ClarificationOption {
  label: string;
  value: string;
  is_custom: boolean;
}

export interface ClarificationQuestion {
  question: string;
  original_question: string;
  options: ClarificationOption[];
}

export interface ForgeChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  chips?: ConstraintChip[];
  activityCard?: ActivityCard;
  clarificationCard?: {
    id: string;
    questions: ClarificationQuestion[];
  };
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
  dirtyFiles: Record<string, true>;

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
  hydrateProject: (projectId: string) => Promise<void>;
  updateFileContent: (id: string, content: string) => void;
  saveFile: (projectId: string, fileId: string) => Promise<boolean>;
  markDirty: (id: string) => void;
  markClean: (id: string) => void;
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
    requirements: 'locked',
    architecture: 'locked',
    build: 'locked',
    deploy: 'locked',
  },
  projectName: '',
  prdText: '',
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
  dirtyFiles: {},

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

  updateFileContent: (id, content) =>
    set((state) => {
      const existing = state.generatedFiles[id];
      if (!existing) return state;
      return {
        generatedFiles: {
          ...state.generatedFiles,
          [id]: { ...existing, lines: content.split('\n').map((l) => ({ content: l })) },
        },
      };
    }),

  saveFile: async (projectId, fileId) => {
    const file = get().generatedFiles[fileId];
    if (!file) return false;
    const content = file.lines.map((l) => l.content).join('\n');
    return saveFileContent(projectId, file.path, content);
  },

  markDirty: (id) =>
    set((state) => ({ dirtyFiles: { ...state.dirtyFiles, [id]: true } })),

  markClean: (id) =>
    set((state) => {
      const next = { ...state.dirtyFiles };
      delete next[id];
      return { dirtyFiles: next };
    }),

  hydrateProject: async (projectId: string) => {
    const headers = authHeaders();
    if (!headers.Authorization) return;

    // ── Helper: mirrors _mapNodeType from forge-agents.ts ──────────────────
    function mapNodeType(service: string): ForgeArchNode['type'] {
      const s = service.toLowerCase();
      if (s.includes('gateway') || s.includes('apigw')) return 'gateway';
      if (s.includes('lambda') || s.includes('function') || s.includes('compute') || s.includes('ec2')) return 'compute';
      if (s.includes('cache') || s.includes('redis') || s.includes('elasticache')) return 'cache';
      if (s.includes('rds') || s.includes('database') || s.includes('postgres') || s.includes('mysql') || s.includes('s3')) return 'storage';
      if (s.includes('auth') || s.includes('cognito') || s.includes('secret')) return 'auth';
      return 'compute';
    }

    // ── PRD hydration ───────────────────────────────────────────────────────
    const { prdText } = get();
    if (!prdText) {
      try {
        const prdResp = await fetch(`${API_URL}/workflows/prd/v2/${projectId}`, { headers });
        if (prdResp.ok) {
          const prdData = await prdResp.json() as {
            session_id?: string;
            status?: string;
            plan_markdown?: string;
            messages?: Array<{ role?: string; type?: string; content?: string }>;
            constraints?: Array<{ id: string; label: string; category: string }>;
          };

          const restoredMessages: ForgeChatMessage[] = (prdData.messages ?? [])
            .filter((m) => m.content)
            .map((m, i) => ({
              id: `hydrated-req-${i}`,
              role: (m.role === 'user' ? 'user' : 'agent') as ForgeChatMessage['role'],
              content: m.content!,
            }));

          const restoredConstraints: ConstraintChip[] = (prdData.constraints ?? []).map((c) => ({
            id: c.id,
            label: c.label,
            category: c.category as ConstraintChip['category'],
          }));

          set((state) => ({
            prdText: prdData.plan_markdown ?? '',
            constraints: restoredConstraints,
            stageStatus: { ...state.stageStatus, requirements: 'done' },
            chatHistory: {
              ...state.chatHistory,
              requirements: restoredMessages.length > 0 ? restoredMessages : state.chatHistory.requirements,
            },
          }));
        }
        // 404 → silently skip
      } catch { /* network error — skip */ }
    }

    // ── Architecture hydration ──────────────────────────────────────────────
    const { architectureData } = get();
    if (!architectureData) {
      try {
        const archResp = await fetch(`${API_URL}/workflows/architecture/v2/${projectId}`, { headers });
        if (archResp.ok) {
          const archData = await archResp.json() as {
            session_id?: string;
            status?: string;
            architecture_diagram?: {
              nodes?: Array<Record<string, unknown>>;
              connections?: Array<Record<string, unknown>>;
            };
            nfr_document?: string;
            eval_score?: number;
          };

          const diagram = archData.architecture_diagram;
          if (diagram?.nodes && diagram.nodes.length > 0) {
            const nodes: ForgeArchNode[] = diagram.nodes.map((n) => ({
              id: String(n.id ?? ''),
              label: String(n.service ?? n.label ?? n.id ?? ''),
              sublabel: String(n.description ?? ''),
              type: mapNodeType(String(n.service ?? n.type ?? '')),
              x: Math.random() * 500,
              y: Math.random() * 400,
              terraformResource: String(n.terraform_resource ?? ''),
              estimatedCost: String(n.estimated_cost ?? ''),
              config: (n.config as Record<string, string>) ?? {},
              whyChosen: String(n.why_chosen ?? ''),
              validates: (n.validates as string[]) ?? [],
              blocks: (n.blocks as string[]) ?? [],
              deployStatus: 'queued' as const,
            }));

            const edges: ForgeArchEdge[] = (diagram.connections ?? []).map((c) => ({
              from: String(c.from ?? c.from_ ?? c.source ?? ''),
              to: String(c.to ?? c.target ?? ''),
            }));

            set((state) => ({
              architectureData: { nodes, edges },
              stageStatus: { ...state.stageStatus, architecture: 'done' },
            }));
          }
        }
        // 404 → silently skip
      } catch { /* network error — skip */ }
    }

    // ── Generated files hydration ───────────────────────────────────────────
    const { generatedFiles } = get();
    if (Object.keys(generatedFiles).length === 0) {
      try {
        const fileList = await getProjectFiles(projectId);
        if (fileList.length > 0) {
          const langMap: Record<string, string> = {
            tf: 'hcl',
            py: 'python',
            ts: 'typescript',
            js: 'javascript',
            yaml: 'yaml',
            yml: 'yaml',
            json: 'json',
            sh: 'bash',
          };
          let idx = 0;
          for (const entry of fileList) {
            const fileData = await getFileContent(projectId, entry.path);
            if (!fileData) continue;
            const ext = entry.name.includes('.') ? entry.name.split('.').pop()! : 'text';
            const file: GeneratedFile = {
              id: `hydrated-${idx++}`,
              name: entry.name,
              path: entry.path,
              lang: entry.lang || langMap[ext] || ext,
              status: 'new',
              lines: fileData.content.split('\n').map((l) => ({ content: l })),
            };
            get().addGeneratedFile(file);
          }
          set((state) => ({
            stageStatus: { ...state.stageStatus, build: 'done' },
          }));
        }
      } catch { /* network error — skip */ }
    }
  },
}));
