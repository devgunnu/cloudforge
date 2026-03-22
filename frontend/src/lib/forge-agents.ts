/**
 * Forge agent service layer.
 * All agent calls are centralised here so the UI never calls external services directly.
 * Swap the MOCK_* constants and the implementation bodies to wire real API calls.
 */

import type {
  ConstraintChip,
  ForgeArchNode,
  ForgeArchEdge,
  GeneratedFile,
} from '@/store/forgeStore';

// ── Utility ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Agent 1 — Requirements → Constraint extraction ────────────────────────────

const MOCK_CONSTRAINTS: ConstraintChip[] = [
  { id: 'c1', label: 'P95 latency < 200ms', category: 'performance' },
  { id: 'c2', label: 'JWT RS256 signing', category: 'security' },
  { id: 'c3', label: 'Cost < $50/mo at 10k users', category: 'cost' },
  { id: 'c4', label: '99.9% uptime SLA', category: 'reliability' },
];

/**
 * BACKEND HOOK: POST /api/agent1
 * Body: { prdText: string }
 * Response stream: Server-Sent Events, each event is a ConstraintChip JSON object.
 */
export async function runAgent1(
  _prdText: string,
  onChip?: (chip: ConstraintChip, index: number) => void
): Promise<ConstraintChip[]> {
  await delay(2000);
  for (let i = 0; i < MOCK_CONSTRAINTS.length; i++) {
    onChip?.(MOCK_CONSTRAINTS[i], i);
    await delay(350);
  }
  return MOCK_CONSTRAINTS;
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

/**
 * BACKEND HOOK: POST /api/agent2
 * Body: { constraints: ConstraintChip[] }
 * Response stream: SSE with { step: number } events, then final { nodes, edges } payload.
 */
export async function runAgent2(
  _constraints: ConstraintChip[],
  onStep?: Agent2StepCallback
): Promise<{ nodes: ForgeArchNode[]; edges: ForgeArchEdge[] }> {
  for (let i = 0; i < AGENT2_STEPS.length; i++) {
    onStep?.(i, AGENT2_STEPS.length);
    await delay(1300 + Math.random() * 400);
  }
  await delay(500);
  return { nodes: MOCK_ARCH_NODES, edges: MOCK_ARCH_EDGES };
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

/**
 * BACKEND HOOK: POST /api/agent3
 * Body: { architectureData: { nodes, edges } }
 * Response stream: SSE with { file: GeneratedFile } events, then { done: true }.
 */
export async function runAgent3(
  _architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] },
  callbacks?: Agent3Callbacks
): Promise<GeneratedFile[]> {
  const total = MOCK_FILES.length;
  callbacks?.onProgress(0, total);

  for (let i = 0; i < MOCK_FILES.length; i++) {
    await delay(1400 + Math.random() * 900);
    callbacks?.onFileReady(MOCK_FILES[i]);
    callbacks?.onProgress(i + 1, total);
  }

  return MOCK_FILES;
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

/**
 * BACKEND HOOK: POST /api/deploy
 * Body: { files: GeneratedFile[], architectureData: { nodes, edges } }
 * Response stream: SSE with { log: string, nodeId?: string, status?: string } events.
 */
export async function runDeploy(
  _files: GeneratedFile[],
  _architectureData: { nodes: ForgeArchNode[]; edges: ForgeArchEdge[] },
  callbacks: DeployCallbacks
): Promise<void> {
  for (const event of DEPLOY_SEQUENCE) {
    await delay(event.ms);
    callbacks.onLog(event.line);
    if (event.nodeId && event.status) {
      callbacks.onNodeStatus(event.nodeId, event.status);
    }
  }
}
