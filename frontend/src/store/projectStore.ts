import { create } from 'zustand';
import { MOCK_PROJECTS, type Project, type ProjectStage } from '@/lib/mock-data';

const STAGE_ORDER: ProjectStage[] = ['prd', 'arch', 'build', 'live'];

interface ProjectStoreState {
  projects: Project[];
  advanceStage: (id: string) => void;
  createProject: (name: string) => string;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
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
}));

export { STAGE_ORDER };
export type { ProjectStage };
