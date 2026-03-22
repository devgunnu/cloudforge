/**
 * Forge agent service layer.
 * All agent calls are centralised here so the UI never calls external services directly.
 */

import type {
  ConstraintChip,
  ForgeArchNode,
  ForgeArchEdge,
  GeneratedFile,
} from '@/store/forgeStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Utility ───────────────────────────────────────────────────────────────────

export function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('cloudforge-auth');
    if (!stored) return {};
    const token = JSON.parse(stored)?.state?.accessToken;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('cloudforge-auth');
    if (!stored) return null;
    const refreshToken = JSON.parse(stored)?.state?.refreshToken;
    if (!refreshToken) return null;

    const resp = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const parsed = JSON.parse(stored);
    parsed.state.accessToken = data.access_token;
    localStorage.setItem('cloudforge-auth', JSON.stringify(parsed));
    return data.access_token;
  } catch {
    return null;
  }
}

export async function streamSSE(
  url: string,
  fetchInit: RequestInit,
  onEvent: (data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const doFetch = async (headers: Record<string, string>) => {
    return fetch(url, {
      ...fetchInit,
      headers: { 'Content-Type': 'application/json', ...fetchInit.headers, ...headers },
      signal,
    });
  };

  let resp = await doFetch({});

  if (resp.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      resp = await doFetch({ Authorization: `Bearer ${newToken}` });
    }
  }

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data && data !== '[DONE]') {
            onEvent(data);
          }
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

// ── Agent 1 — Requirements → Constraint extraction ────────────────────────────

export async function runAgent1(
  prdText: string,
  onChip?: (chip: ConstraintChip, index: number) => void,
  projectId?: string,
  signal?: AbortSignal,
): Promise<ConstraintChip[]> {
  if (!projectId) {
    throw new Error('runAgent1 requires a projectId');
  }

  const chips: ConstraintChip[] = [];

  await streamSSE(
    `${API_URL}/workflows/prd/v2/start/${projectId}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prd_text: prdText, cloud_provider: 'aws' }),
    },
    (data) => {
      try {
        const event = JSON.parse(data);
        if (event.type === 'constraint' && event.chip) {
          chips.push(event.chip);
          onChip?.(event.chip, chips.length - 1);
        }
      } catch { /* ignore parse errors */ }
    },
    signal,
  );

  return chips;
}

// ── Agent 2 — Constraints → Architecture ──────────────────────────────────────

export interface Agent2StepCallback {
  (step: number, total: number): void;
}

export const AGENT2_STEPS = [
  'Parsing NFR constraints',
  'Graph traversal',
  'Conflict resolution',
  'Generating explanation',
] as const;

function _mapNodeType(service: string): ForgeArchNode['type'] {
  const s = service.toLowerCase();
  if (s.includes('gateway') || s.includes('apigw')) return 'gateway';
  if (s.includes('lambda') || s.includes('function') || s.includes('compute') || s.includes('ec2')) return 'compute';
  if (s.includes('cache') || s.includes('redis') || s.includes('elasticache')) return 'cache';
  if (s.includes('rds') || s.includes('database') || s.includes('postgres') || s.includes('mysql') || s.includes('s3')) return 'storage';
  if (s.includes('auth') || s.includes('cognito') || s.includes('secret')) return 'auth';
  return 'compute';
}

export async function runAgent2(
  _constraints: ConstraintChip[],
  onStep?: Agent2StepCallback,
  projectId?: string,
  signal?: AbortSignal,
): Promise<{ nodes: ForgeArchNode[]; edges: ForgeArchEdge[] }> {
  if (!projectId) {
    throw new Error('runAgent2 requires a projectId');
  }

  let nodes: ForgeArchNode[] = [];
  let edges: ForgeArchEdge[] = [];

  await streamSSE(
    `${API_URL}/workflows/architecture/v2/start/${projectId}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    },
    (data) => {
      try {
        const event = JSON.parse(data);
        if (event.step !== undefined) {
          onStep?.(event.step - 1, 7);
        }
        if (event.node === 'complete' && event.architecture_diagram) {
          const diagram = event.architecture_diagram;
          nodes = (diagram.nodes || []).map((n: Record<string, unknown>) => ({
            id: String(n.id || ''),
            label: String(n.service || n.label || n.id || ''),
            sublabel: String(n.description || ''),
            type: _mapNodeType(String(n.service || n.type || '')),
            x: Math.random() * 500,
            y: Math.random() * 400,
            terraformResource: String(n.terraform_resource || ''),
            estimatedCost: String(n.estimated_cost || ''),
            config: (n.config as Record<string, string>) || {},
            whyChosen: String(n.why_chosen || ''),
            validates: (n.validates as string[]) || [],
            blocks: (n.blocks as string[]) || [],
            deployStatus: 'queued' as const,
          }));
          edges = (diagram.connections || []).map((c: Record<string, unknown>) => ({
            from: String(c.from || c.from_ || c.source || ''),
            to: String(c.to || c.target || ''),
          }));
        }
      } catch { /* ignore */ }
    },
    signal,
  );

  return { nodes, edges };
}

// ── Agent 3 — Architecture → Code generation ──────────────────────────────────

export interface Agent3Callbacks {
  onProgress: (filesComplete: number, total: number) => void;
  onFileReady: (file: GeneratedFile) => void;
}

export async function runAgent3(
  architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] },
  callbacks?: Agent3Callbacks,
  projectId?: string,
  signal?: AbortSignal,
): Promise<GeneratedFile[]> {
  if (!projectId) {
    throw new Error('runAgent3 requires a projectId');
  }

  const files: GeneratedFile[] = [];

  await streamSSE(
    `${API_URL}/workflows/build/start/${projectId}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    },
    (data) => {
      try {
        const event = JSON.parse(data) as Record<string, unknown>;
        if (event.phase === 'complete' && event.artifacts) {
          const artifacts = event.artifacts as Record<string, string>;
          let idx = 0;
          for (const [path, content] of Object.entries(artifacts)) {
            if (typeof content !== 'string') continue;
            const name = path.split('/').pop() || path;
            const ext = name.includes('.') ? name.split('.').pop()! : 'text';
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
            const file: GeneratedFile = {
              id: `f${idx++}`,
              name,
              path,
              lang: langMap[ext] || ext,
              status: 'new',
              lines: content.split('\n').map((l) => ({ content: l, highlight: false })),
            };
            files.push(file);
            callbacks?.onFileReady(file);
            callbacks?.onProgress(files.length, Object.keys(artifacts).length);
          }
        } else if (
          event.phase === 'orchestrator' ||
          event.phase === 'tf_generator' ||
          event.phase === 'assembler'
        ) {
          const done = (event.tasks_done as number) || 0;
          const total = (event.tasks_total as number) || files.length || 1;
          callbacks?.onProgress(done, total);
        }
      } catch { /* ignore */ }
    },
    signal,
  );

  // architectureData is intentionally unused when a real projectId is provided;
  // the backend derives the build from its own stored architecture session.
  void architectureData;

  return files;
}

// ── Deploy agent ──────────────────────────────────────────────────────────────

export interface DeployCallbacks {
  onLog: (line: string) => void;
  onNodeStatus: (
    nodeId: string,
    status: 'provisioning' | 'live'
  ) => void;
}

export async function runDeploy(
  _files: GeneratedFile[],
  _architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] },
  callbacks: DeployCallbacks,
  projectId?: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!projectId) {
    throw new Error('runDeploy requires a projectId');
  }

  await streamSSE(
    `${API_URL}/workflows/deploy/start/${projectId}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    },
    (data) => {
      try {
        const event = JSON.parse(data) as Record<string, unknown>;
        if (event.type === 'log') {
          callbacks.onLog(event.line as string);
        } else if (event.type === 'node_status') {
          callbacks.onNodeStatus(
            event.nodeId as string,
            event.status as 'provisioning' | 'live'
          );
        }
      } catch { /* ignore */ }
    },
    signal,
  );
}
