// ── Types ────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'deployed' | 'building' | 'draft';
export type ProjectStage = 'prd' | 'arch' | 'build' | 'live';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  stage: ProjectStage;
  region: string;
  updatedAt: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: string;
  planCard?: {
    functional: string[];
    features: string[];
  };
}

export interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  layer: 'app' | 'infra';
  x: number;
  y: number;
  isNew?: boolean;
  isActive?: boolean;
}

export interface ArchEdge {
  from: string;
  to: string;
}

export interface FileNode {
  name: string;
  type: 'file' | 'dir';
  status?: 'done' | 'writing' | 'pending';
  category?: 'infra' | 'src' | 'config';
  children?: FileNode[];
}

export interface BuildStep {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending';
  subAgents?: {
    name: string;
    output: string;
    status: 'done' | 'active' | 'pending';
  }[];
}

export interface LogLine {
  id: string;
  timestamp: string;
  agent: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'main';
}
