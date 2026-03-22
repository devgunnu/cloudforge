import { create } from 'zustand';
import { MOCK_PROJECTS, type Project, type ProjectStage } from '@/lib/mock-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const STAGE_ORDER: ProjectStage[] = ['prd', 'arch', 'build', 'live'];

// API-backed project shape (returned from backend)
interface ApiProject {
  id: string;
  name: string;
  description?: string;
  stage: string;
  status: string;
  region?: string;
  cloud_provider?: string;
  prd_session_id?: string;
  arch_session_id?: string;
  build_id?: string;
  deployment_id?: string;
  github_repo?: string;
  github_connected: boolean;
  cloud_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectStoreState {
  // Legacy mock-backed state (used by existing dashboard UI)
  projects: Project[];
  advanceStage: (id: string) => void;
  createProject: (name: string) => string;

  // API-backed state
  apiProjects: ApiProject[];
  currentProjectId: string | null;
  isLoading: boolean;
  loadProjects: (token: string) => Promise<void>;
  createApiProject: (name: string, token: string) => Promise<ApiProject>;
  setCurrentProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  // ── Legacy mock state ──────────────────────────────────────────────────────
  projects: [...MOCK_PROJECTS],

  advanceStage: (id) =>
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== id) return p;
        const idx = STAGE_ORDER.indexOf(p.stage);
        const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
        return { ...p, stage: next };
      }),
    })),

  createProject: (name) => {
    const id = `proj-${Date.now()}`;
    const newProject: Project = {
      id,
      name,
      status: 'draft',
      stage: 'prd',
      region: 'us-east-1',
      updatedAt: 'Just now',
      description: 'New project — add a description in the PRD chat.',
    };
    set((state) => ({ projects: [...state.projects, newProject] }));
    return id;
  },

  // ── API-backed state ───────────────────────────────────────────────────────
  apiProjects: [],
  currentProjectId: null,
  isLoading: false,

  loadProjects: async (token: string) => {
    set({ isLoading: true });
    try {
      const resp = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        set({ apiProjects: data });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createApiProject: async (name: string, token: string) => {
    const resp = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error('Failed to create project');
    const project: ApiProject = await resp.json();
    set((state) => ({ apiProjects: [...state.apiProjects, project] }));
    return project;
  },

  setCurrentProjectId: (id) => set({ currentProjectId: id }),
}));

export { STAGE_ORDER };
export type { ProjectStage };
