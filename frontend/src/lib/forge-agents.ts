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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders(): Record<string, string> {
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

async function streamSSE(
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

const MOCK_CONSTRAINTS: ConstraintChip[] = [
  { id: 'c1', label: 'P95 latency < 200ms', category: 'performance' },
  { id: 'c2', label: 'JWT RS256 signing', category: 'security' },
  { id: 'c3', label: 'Cost < $50/mo at 10k users', category: 'cost' },
  { id: 'c4', label: '99.9% uptime SLA', category: 'reliability' },
];

export async function runAgent1(
  prdText: string,
  onChip?: (chip: ConstraintChip, index: number) => void,
  projectId?: string,
  signal?: AbortSignal,
): Promise<ConstraintChip[]> {
  const chips: ConstraintChip[] = [];

  if (!projectId) {
    await delay(2000);
    for (let i = 0; i < MOCK_CONSTRAINTS.length; i++) {
      onChip?.(MOCK_CONSTRAINTS[i], i);
      await delay(350);
    }
    return MOCK_CONSTRAINTS;
  }

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

const MOCK_ARCH_NODES: ForgeArchNode[] = [
  {
    id: 'apigw',
    label: 'API Gateway',
    sublabel: 'REST · HTTP/2',
    type: 'gateway',
    x: 300,
    y: 30,
    terraformResource: 'aws_apigatewayv2_api',
    estimatedCost: '$3.50/mo',
    config: {
      protocol: 'HTTP',
      cors: 'enabled',
      throttle: '10,000 req/s',
      stage: '$default',
    },
    whyChosen:
      'HTTP/2 API Gateway provides built-in throttling satisfying the rate-limiting NFR without Lambda-side logic, and its managed TLS satisfies the security NFR.',
    validates: ['P95 latency < 200ms', '99.9% uptime SLA'],
    blocks: [],
    deployStatus: 'queued',
  },
  {
    id: 'lambda',
    label: 'Lambda Auth',
    sublabel: 'Node 20 · 512 MB',
    type: 'compute',
    x: 300,
    y: 160,
    terraformResource: 'aws_lambda_function',
    estimatedCost: '$1.20/mo',
    config: {
      runtime: 'nodejs20.x',
      memory: '512 MB',
      timeout: '10s',
      concurrency: '100',
      architecture: 'arm64',
    },
    whyChosen:
      'Stateless Lambda is ideal for JWT validation — cold start under 200ms on Node 20 arm64. Scales to zero when idle, satisfying the cost NFR.',
    validates: ['P95 latency < 200ms', 'JWT RS256 signing', 'Cost < $50/mo at 10k users'],
    blocks: [],
    deployStatus: 'queued',
  },
  {
    id: 'redis',
    label: 'ElastiCache',
    sublabel: 'Redis 7 · t3.micro',
    type: 'cache',
    x: 100,
    y: 300,
    terraformResource: 'aws_elasticache_cluster',
    estimatedCost: '$12.80/mo',
    config: {
      engine: 'redis',
      version: '7.0',
      instance: 'cache.t3.micro',
      ttl: '3600s',
      maxmemory_policy: 'allkeys-lru',
    },
    whyChosen:
      'Redis session cache brings token validation lookups to sub-5ms — critical for the P95 < 200ms constraint. Refresh token storage also lands here.',
    validates: ['P95 latency < 200ms', 'Cost < $50/mo at 10k users'],
    blocks: [],
    deployStatus: 'queued',
  },
  {
    id: 'rds',
    label: 'RDS Postgres',
    sublabel: 'pg 15 · t3.micro',
    type: 'storage',
    x: 500,
    y: 300,
    terraformResource: 'aws_db_instance',
    estimatedCost: '$14.40/mo',
    config: {
      engine: 'postgres',
      version: '15',
      instance: 'db.t3.micro',
      storage: '20 GB',
      multi_az: 'false',
      backup_retention: '7 days',
    },
    whyChosen:
      'RDS Postgres satisfies the audit logging requirement — WAL-based change capture is built in. Multi-AZ disabled to stay under the cost NFR at this scale.',
    validates: ['99.9% uptime SLA'],
    blocks: [],
    deployStatus: 'queued',
  },
  {
    id: 'secrets',
    label: 'Secrets Manager',
    sublabel: 'RS256 keys',
    type: 'auth',
    x: 300,
    y: 420,
    terraformResource: 'aws_secretsmanager_secret',
    estimatedCost: '$0.80/mo',
    config: {
      rotation: '90 days',
      kms: 'aws/secretsmanager',
      replication: 'disabled',
      versions: '2',
    },
    whyChosen:
      'Stores RS256 private key with automatic rotation, satisfying the JWT RS256 signing NFR without hard-coding credentials in environment variables.',
    validates: ['JWT RS256 signing'],
    blocks: [],
    deployStatus: 'queued',
  },
];

const MOCK_ARCH_EDGES: ForgeArchEdge[] = [
  { from: 'apigw', to: 'lambda' },
  { from: 'lambda', to: 'redis' },
  { from: 'lambda', to: 'rds' },
  { from: 'lambda', to: 'secrets' },
];

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
    for (let i = 0; i < AGENT2_STEPS.length; i++) {
      onStep?.(i, AGENT2_STEPS.length);
      await delay(1300 + Math.random() * 400);
    }
    await delay(500);
    return { nodes: MOCK_ARCH_NODES, edges: MOCK_ARCH_EDGES };
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

  return nodes.length > 0 ? { nodes, edges } : { nodes: MOCK_ARCH_NODES, edges: MOCK_ARCH_EDGES };
}

export { MOCK_ARCH_NODES, MOCK_ARCH_EDGES };

// ── Agent 3 — Architecture → Code generation ──────────────────────────────────

export interface Agent3Callbacks {
  onProgress: (filesComplete: number, total: number) => void;
  onFileReady: (file: GeneratedFile) => void;
}

const MOCK_FILES: GeneratedFile[] = [
  {
    id: 'f1',
    name: 'main.tf',
    path: 'infra/main.tf',
    lang: 'hcl',
    status: 'new',
    lines: [
      { content: 'terraform {' },
      { content: '  required_version = ">= 1.6"' },
      { content: '  required_providers {' },
      { content: '    aws = {' },
      { content: '      source  = "hashicorp/aws"' },
      { content: '      version = "~> 5.0"' },
      { content: '    }' },
      { content: '  }' },
      { content: '  backend "s3" {' },
      { content: '    bucket = var.tf_state_bucket' },
      { content: '    key    = "auth-service/terraform.tfstate"' },
      { content: '    region = var.aws_region' },
      { content: '  }' },
      { content: '}' },
      { content: '' },
      { content: 'provider "aws" {' },
      { content: '  region = var.aws_region' },
      { content: '}' },
    ],
  },
  {
    id: 'f2',
    name: 'lambda.tf',
    path: 'infra/lambda.tf',
    lang: 'hcl',
    status: 'new',
    nodeId: 'lambda',
    lines: [
      { content: 'resource "aws_lambda_function" "auth" {' },
      { content: '  function_name = "${var.project_name}-auth"' },
      { content: '  runtime       = "nodejs20.x"' },
      { content: '  handler       = "index.handler"' },
      { content: '  memory_size   = 512' },
      { content: '  timeout       = 10' },
      { content: '  architectures = ["arm64"]' },
      { content: '' },
      { content: '  environment {' },
      { content: '    variables = {' },
      { content: '      REDIS_URL    = aws_elasticache_cluster.cache.cache_nodes[0].address' },
      { content: '      DATABASE_URL = aws_db_instance.postgres.endpoint' },
      { content: '      SECRET_ARN   = aws_secretsmanager_secret.jwt_key.arn' },
      { content: '    }' },
      { content: '  }' },
      { content: '}' },
    ],
  },
  {
    id: 'f3',
    name: 'index.ts',
    path: 'src/index.ts',
    lang: 'typescript',
    status: 'new',
    nodeId: 'lambda',
    lines: [
      { content: 'import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";' },
      { content: 'import { verifyJWT } from "./auth/jwt";' },
      { content: 'import { rateLimiter } from "./middleware/rateLimit";' },
      { content: 'import { auditLog } from "./services/audit";' },
      { content: '' },
      { content: 'export async function handler(' },
      { content: '  event: APIGatewayEvent' },
      { content: '): Promise<APIGatewayProxyResult> {' },
      { content: '  const allowed = await rateLimiter.check(' },
      { content: '    event.requestContext.identity.sourceIp' },
      { content: '  );' },
      { content: '  if (!allowed) return { statusCode: 429, body: "Too Many Requests" };' },
      { content: '' },
      { content: '  const token = event.headers.Authorization?.split(" ")[1];' },
      { content: '  if (!token) return { statusCode: 401, body: "Unauthorized" };' },
      { content: '' },
      { content: '  const payload = await verifyJWT(token);' },
      { content: '  await auditLog({ userId: payload.sub, action: event.path });' },
      { content: '' },
      { content: '  return { statusCode: 200, body: JSON.stringify(payload) };' },
      { content: '}' },
    ],
  },
  {
    id: 'f4',
    name: 'jwt.ts',
    path: 'src/auth/jwt.ts',
    lang: 'typescript',
    status: 'new',
    nodeId: 'secrets',
    lines: [
      { content: 'import * as jwt from "jsonwebtoken";' },
      { content: 'import { getSecret } from "../services/secrets";' },
      { content: '' },
      { content: 'export async function verifyJWT(token: string) {' },
      { content: '  const publicKey = await getSecret("jwt-public-key");' },
      { content: '  return jwt.verify(token, publicKey, {' },
      { content: '    algorithms: ["RS256"],' },
      { content: '  });' },
      { content: '}' },
      { content: '' },
      { content: 'export async function signJWT(payload: Record<string, unknown>) {' },
      { content: '  const privateKey = await getSecret("jwt-private-key");' },
      { content: '  return jwt.sign(payload, privateKey, {' },
      { content: '    algorithm: "RS256",' },
      { content: '    expiresIn: "15m",' },
      { content: '  });' },
      { content: '}' },
    ],
  },
  {
    id: 'f5',
    name: 'rds.tf',
    path: 'infra/rds.tf',
    lang: 'hcl',
    status: 'new',
    nodeId: 'rds',
    lines: [
      { content: 'resource "aws_db_instance" "postgres" {' },
      { content: '  identifier        = "${var.project_name}-db"' },
      { content: '  engine            = "postgres"' },
      { content: '  engine_version    = "15"' },
      { content: '  instance_class    = "db.t3.micro"' },
      { content: '  allocated_storage = 20' },
      { content: '  username          = var.db_username' },
      { content: '  password          = var.db_password' },
      { content: '  skip_final_snapshot = true' },
      { content: '  backup_retention_period = 7' },
      { content: '  deletion_protection     = false' },
      { content: '}' },
    ],
  },
];

export { MOCK_FILES };

export async function runAgent3(
  architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] },
  callbacks?: Agent3Callbacks,
  projectId?: string,
  signal?: AbortSignal,
): Promise<GeneratedFile[]> {
  if (!projectId) {
    const total = MOCK_FILES.length;
    callbacks?.onProgress(0, total);
    for (let i = 0; i < MOCK_FILES.length; i++) {
      await delay(1400 + Math.random() * 900);
      callbacks?.onFileReady(MOCK_FILES[i]);
      callbacks?.onProgress(i + 1, total);
    }
    return MOCK_FILES;
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

  return files.length > 0 ? files : MOCK_FILES;
}

// ── Deploy agent ──────────────────────────────────────────────────────────────

export interface DeployCallbacks {
  onLog: (line: string) => void;
  onNodeStatus: (
    nodeId: string,
    status: 'provisioning' | 'live'
  ) => void;
}

const DEPLOY_SEQUENCE: Array<{
  ms: number;
  line: string;
  nodeId?: string;
  status?: 'provisioning' | 'live';
}> = [
  { ms: 400,  line: '⟳  Initialising Terraform workspace…' },
  { ms: 700,  line: '⟳  Resolving provider hashicorp/aws v5.0.3' },
  { ms: 500,  line: '✓  Provider lock file written' },
  { ms: 900,  line: '⟳  Creating API Gateway (aws_apigatewayv2_api.forge)…', nodeId: 'apigw', status: 'provisioning' },
  { ms: 1200, line: '✓  API Gateway created — ID: a1b2c3d4e5f6', nodeId: 'apigw', status: 'live' },
  { ms: 600,  line: '⟳  Packaging Lambda source (src/ → dist.zip)' },
  { ms: 800,  line: '⟳  Deploying Lambda function (aws_lambda_function.auth)…', nodeId: 'lambda', status: 'provisioning' },
  { ms: 1400, line: '✓  Lambda deployed — ARN: arn:aws:lambda:us-east-1:123456789:function:auth', nodeId: 'lambda', status: 'live' },
  { ms: 600,  line: '⟳  Provisioning ElastiCache cluster (aws_elasticache_cluster.cache)…', nodeId: 'redis', status: 'provisioning' },
  { ms: 1600, line: '✓  ElastiCache ready — endpoint: auth-cache.abc123.cfg.use1.cache.amazonaws.com', nodeId: 'redis', status: 'live' },
  { ms: 500,  line: '⟳  Creating RDS instance (aws_db_instance.postgres)…', nodeId: 'rds', status: 'provisioning' },
  { ms: 2000, line: '✓  RDS ready — endpoint: auth-db.xyz.us-east-1.rds.amazonaws.com:5432', nodeId: 'rds', status: 'live' },
  { ms: 400,  line: '⟳  Storing RS256 key pair in Secrets Manager…', nodeId: 'secrets', status: 'provisioning' },
  { ms: 800,  line: '✓  JWT RS256 key pair stored — ARN: arn:aws:secretsmanager:us-east-1:…', nodeId: 'secrets', status: 'live' },
  { ms: 500,  line: '⟳  Wiring Lambda environment variables…' },
  { ms: 400,  line: '✓  Environment variables updated' },
  { ms: 300,  line: '✓  Terraform state written to S3 backend' },
  { ms: 300,  line: '✓  Deployment complete — 5 resources provisioned, est. $32.70/mo' },
];

export async function runDeploy(
  _files: GeneratedFile[],
  _architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] },
  callbacks: DeployCallbacks,
  projectId?: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!projectId) {
    for (const event of DEPLOY_SEQUENCE) {
      await delay(event.ms);
      callbacks.onLog(event.line);
      if (event.nodeId && event.status) {
        callbacks.onNodeStatus(event.nodeId, event.status);
      }
    }
    return;
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
