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

// ── Mock Projects ─────────────────────────────────────────────────────────────

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    name: 'auth-service-api',
    status: 'deployed',
    stage: 'live',
    region: 'us-east-1',
    updatedAt: '2h ago',
    description:
      'JWT-based authentication service with rate limiting, refresh token rotation, and a built-in admin dashboard.',
  },
  {
    id: 'proj-002',
    name: 'data-pipeline',
    status: 'building',
    stage: 'build',
    region: 'eu-west-1',
    updatedAt: '12m ago',
    description:
      'Event-driven ingestion pipeline using Kinesis, Lambda, and S3 for real-time analytics processing.',
  },
  {
    id: 'proj-003',
    name: 'ml-inference-layer',
    status: 'draft',
    stage: 'prd',
    region: 'us-west-2',
    updatedAt: 'Yesterday',
    description:
      'SageMaker-backed inference endpoint for on-demand model serving with auto-scaling and A/B routing.',
  },
];

// ── Mock Chat Messages ────────────────────────────────────────────────────────

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-001',
    role: 'agent',
    content:
      "Hey! I'm CloudForge. Tell me about the product you're building — what does it do, who's it for, and what does the happy path look like?",
    timestamp: '09:12:01',
  },
  {
    id: 'msg-002',
    role: 'user',
    content:
      "I need a REST API with JWT auth, rate limiting, and a dashboard. It's for a SaaS product — users sign up, get an API key, and call our endpoints. The dashboard shows usage metrics.",
    timestamp: '09:12:44',
  },
  {
    id: 'msg-003',
    role: 'agent',
    content:
      'Got it. A few quick clarifying questions: What database are you planning to use for user records? And do you need multi-tenancy from the start, or is single-tenant fine for now?',
    timestamp: '09:13:05',
  },
  {
    id: 'msg-004',
    role: 'user',
    content:
      "Postgres for users and audit logs. Start single-tenant — we'll add multi-tenancy in v2. Also, the rate limiter needs to support per-API-key quotas, not just IP-based.",
    timestamp: '09:13:52',
  },
  {
    id: 'msg-005',
    role: 'agent',
    content:
      "Perfect. One more: what's the expected peak request volume? This will help me size the Lambda concurrency and ElastiCache instance for the rate limiter.",
    timestamp: '09:14:10',
  },
  {
    id: 'msg-006',
    role: 'user',
    content:
      "Maybe 500 req/s at peak for now. We don't need anything massive yet — just needs to be horizontally scalable when the time comes.",
    timestamp: '09:14:38',
  },
  {
    id: 'msg-007',
    role: 'agent',
    content:
      "I've put together an infrastructure plan based on what you described. Here's what I'm proposing:",
    timestamp: '09:14:55',
    planCard: {
      functional: [
        'API Gateway → Lambda for stateless request handling',
        'ElastiCache (Redis) for per-key rate limiting at sub-millisecond latency',
        'RDS Postgres (t4g.medium) for user records and audit logs',
        'S3 for dashboard static assets and log archival',
      ],
      features: [
        'JWT RS256 tokens with 15min access / 7d refresh rotation',
        'Rate limiter: sliding window, 1000 req/min per API key',
        'Admin dashboard: usage metrics, key management, audit trail',
        'Auto-scaling Lambda concurrency up to 500 concurrent executions',
      ],
    },
  },
  {
    id: 'msg-008',
    role: 'agent',
    content:
      "Does this look right? Once you confirm I'll start scaffolding the infrastructure and writing the service code.",
    timestamp: '09:15:02',
  },
];

// ── Mock Architecture Nodes ───────────────────────────────────────────────────

export const MOCK_ARCH_NODES: ArchNode[] = [
  { id: 'api-gateway', label: 'API Gateway', sublabel: 'REST API', layer: 'app', x: 80, y: 80 },
  { id: 'lambda', label: 'Lambda', sublabel: 'Node.js 20', layer: 'app', x: 260, y: 80, isActive: true },
  { id: 'elasticache', label: 'ElastiCache', sublabel: 'Redis 7', layer: 'app', x: 440, y: 80, isNew: true },
  { id: 'rds', label: 'RDS Postgres', sublabel: 'pg 15 / t4g.med', layer: 'app', x: 620, y: 80 },
  { id: 'vpc', label: 'VPC', sublabel: '10.0.0.0/16', layer: 'infra', x: 80, y: 240 },
  { id: 'iam', label: 'IAM Roles', sublabel: 'Least privilege', layer: 'infra', x: 260, y: 240 },
  { id: 'cloudwatch', label: 'CloudWatch', sublabel: 'Logs + Metrics', layer: 'infra', x: 440, y: 240 },
  { id: 's3', label: 'S3', sublabel: 'us-east-1', layer: 'infra', x: 620, y: 240 },
];

// ── Mock Architecture Edges ───────────────────────────────────────────────────

export const MOCK_ARCH_EDGES: ArchEdge[] = [
  { from: 'api-gateway', to: 'lambda' },
  { from: 'lambda', to: 'elasticache' },
  { from: 'lambda', to: 'rds' },
  { from: 'lambda', to: 's3' },
];

// ── Mock File Tree ────────────────────────────────────────────────────────────

export const MOCK_FILE_TREE: FileNode[] = [
  {
    name: 'infra',
    type: 'dir',
    category: 'infra',
    children: [
      { name: 'main.tf', type: 'file', status: 'done', category: 'infra' },
      { name: 'vpc.tf', type: 'file', status: 'done', category: 'infra' },
      { name: 'rds.tf', type: 'file', status: 'done', category: 'infra' },
    ],
  },
  {
    name: 'src',
    type: 'dir',
    category: 'src',
    children: [
      {
        name: 'auth',
        type: 'dir',
        children: [
          { name: 'jwt.ts', type: 'file', status: 'done' },
          { name: 'middleware.ts', type: 'file', status: 'writing' },
        ],
      },
      {
        name: 'api',
        type: 'dir',
        children: [
          { name: 'routes.ts', type: 'file', status: 'done' },
          { name: 'handlers.ts', type: 'file', status: 'writing' },
        ],
      },
      {
        name: 'db',
        type: 'dir',
        children: [{ name: 'migrations.ts', type: 'file', status: 'pending' }],
      },
    ],
  },
  {
    name: 'config',
    type: 'dir',
    category: 'config',
    children: [{ name: 'serverless.yml', type: 'file', status: 'pending', category: 'config' }],
  },
];

// ── Mock Log Lines ────────────────────────────────────────────────────────────

export const MOCK_LOG_LINES: LogLine[] = [
  { id: 'log-01', timestamp: '09:14:04', agent: 'main', message: 'Scaffold project structure initialized', level: 'main' },
  { id: 'log-02', timestamp: '09:14:05', agent: 'main', message: 'Configuring AWS provider — region: us-east-1', level: 'main' },
  { id: 'log-03', timestamp: '09:14:07', agent: 'infra', message: 'Writing vpc.tf — CIDR 10.0.0.0/16, 2 public + 2 private subnets', level: 'info' },
  { id: 'log-04', timestamp: '09:14:09', agent: 'infra', message: 'Writing rds.tf — RDS Postgres t4g.medium, multi-AZ disabled (dev mode)', level: 'info' },
  { id: 'log-05', timestamp: '09:14:12', agent: 'infra', message: 'main.tf complete — provider + backend configured', level: 'info' },
  { id: 'log-06', timestamp: '09:14:14', agent: 'auth', message: 'jwt.ts — RS256 token signing with 15min expiry complete', level: 'info' },
  { id: 'log-07', timestamp: '09:14:16', agent: 'auth', message: 'Writing middleware.ts — attaching rate limiter guard to route handlers', level: 'info' },
  { id: 'log-08', timestamp: '09:14:19', agent: 'api', message: 'routes.ts — 6 endpoints registered (POST /auth, GET /keys, DELETE /keys/:id, …)', level: 'info' },
  { id: 'log-09', timestamp: '09:14:21', agent: 'api', message: 'Writing handlers.ts — wiring Lambda event parsing + response shaping', level: 'info' },
  { id: 'log-10', timestamp: '09:14:24', agent: 'db', message: 'migrations.ts queued — waiting for RDS endpoint from terraform output', level: 'warn' },
  { id: 'log-11', timestamp: '09:14:26', agent: 'auth', message: 'middleware.ts — sliding window algorithm applied, 1000 req/min per key', level: 'info' },
  { id: 'log-12', timestamp: '09:14:29', agent: 'api', message: 'handlers.ts — injecting ElastiCache client for rate limit counters', level: 'info' },
  { id: 'log-13', timestamp: '09:14:31', agent: 'main', message: 'Write services step 67% complete — 2 agents active, 1 pending', level: 'main' },
  { id: 'log-14', timestamp: '09:14:33', agent: 'main', message: 'ETA to deploy step: ~3 minutes', level: 'main' },
];

// ── Mock Build Steps ──────────────────────────────────────────────────────────

export const MOCK_BUILD_STEPS: BuildStep[] = [
  {
    id: 'step-01',
    label: 'Scaffold project',
    status: 'done',
  },
  {
    id: 'step-02',
    label: 'Configure infrastructure',
    status: 'done',
  },
  {
    id: 'step-03',
    label: 'Write services',
    status: 'active',
    subAgents: [
      { name: 'auth-agent', output: 'Writing jwt.ts — token signing logic', status: 'done' },
      { name: 'api-agent', output: 'Writing routes.ts — endpoint definitions', status: 'active' },
      { name: 'db-agent', output: 'Waiting for RDS terraform output', status: 'pending' },
    ],
  },
  {
    id: 'step-04',
    label: 'Run tests',
    status: 'pending',
  },
  {
    id: 'step-05',
    label: 'Deploy to AWS',
    status: 'pending',
  },
];
