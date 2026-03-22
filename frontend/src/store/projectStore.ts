import { create } from 'zustand';
import { type Project, type ProjectStage, type ProjectStatus } from '@/lib/mock-data';

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
  // Projects list (populated from API)
  projects: Project[];
  advanceStage: (id: string) => void;

  // API-backed state
  apiProjects: ApiProject[];
  currentProjectId: string | null;
  isLoading: boolean;
  loadError: string | null;
  loadProjects: (token: string) => Promise<void>;
  createApiProject: (name: string, token: string) => Promise<ApiProject>;
  deleteApiProject: (id: string, token: string) => Promise<void>;
  setCurrentProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  projects: [],

  advanceStage: (id) =>
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== id) return p;
        const idx = STAGE_ORDER.indexOf(p.stage);
        const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
        return { ...p, stage: next };
      }),
    })),

  // ── API-backed state ───────────────────────────────────────────────────────
  apiProjects: [],
  currentProjectId: null,
  isLoading: false,
  loadError: null,

  loadProjects: async (token: string) => {
    set({ isLoading: true, loadError: null });
    try {
      const resp = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        set({ loadError: `Failed to load projects (${resp.status})` });
        return;
      }
      const data: ApiProject[] = await resp.json();
      const now = Date.now();
      const projects: Project[] = data.map((p) => {
        const updatedMs = new Date(p.updated_at).getTime();
        const diffMs = now - updatedMs;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        let updatedAt: string;
        if (diffMin < 60) {
          updatedAt = `${diffMin}m ago`;
        } else if (diffHr < 24) {
          updatedAt = `${diffHr}h ago`;
        } else {
          updatedAt = new Date(p.updated_at).toLocaleDateString();
        }
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? '',
          stage: p.stage as ProjectStage,
          status: p.status as ProjectStatus,
          region: p.region ?? 'us-east-1',
          updatedAt,
        };
      });
      set({ apiProjects: data, projects });
    } catch (err) {
      set({ loadError: err instanceof Error ? err.message : 'Failed to load projects' });
    } finally {
      set({ isLoading: false });
    }
  },

  createApiProject: async (name: string, token: string) => {
    const resp = await fetch(`${API_URL}/projects/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error('Failed to create project');
    const project: ApiProject = await resp.json();
    set((state) => ({ apiProjects: [...state.apiProjects, project] }));
    return project;
  },

  deleteApiProject: async (id: string, token: string) => {
    const resp = await fetch(`${API_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('Failed to delete project');
    set((state) => ({
      apiProjects: state.apiProjects.filter((p) => p.id !== id),
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },

  setCurrentProjectId: (id) => set({ currentProjectId: id }),
}));

export { STAGE_ORDER };
export type { ProjectStage };
