'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ForgeArchNode, ForgeArchEdge } from '@/store/forgeStore';
import { AWS_ICONS, type AwsIconKey } from '@/lib/aws-icons';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type DrawIONodeType = 'service' | 'group' | 'sectionLabel' | 'user';

export type AWSServiceId =
  | 'lambda'
  | 's3'
  | 'apigateway'
  | 'sqs'
  | 'eventbridge'
  | 'bedrock'
  | 'neptune'
  | 'amplify'
  | 'dynamodb'
  | 'rds'
  | 'cloudfront'
  | 'cognito'
  | 'ecs'
  | 'sns'
  | 'stepfunctions'
  | 'route53'
  | 'elb'
  | 'ec2'
  | 'eks'
  | 'kinesis'
  | 'internet'
  | 'generic';

export interface DrawIONode {
  id: string;
  type: DrawIONodeType;
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  service?: AWSServiceId;
  width?: number;
  height?: number;
  groupColor?: string;
  layer?: string;
  /** Optional per-node config override */
  config?: Record<string, string>;
  description?: string;
}

export interface DrawIOEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface ArchDiagramProps {
  nodes?: DrawIONode[];
  edges?: DrawIOEdge[];
  /**
   * When provided, ArchDiagram runs in controlled mode:
   * - node clicks call onNodeSelect instead of opening the internal ConfigPanel
   * - the internal side panel is suppressed
   */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Controlled selected node ID — used for the selection ring when in controlled mode */
  selectedNodeId?: string | null;
}

/* ── AWS Service Config ──────────────────────────────────────────────────────── */

interface ServiceConfig {
  bg: string;
  shape: 'circle' | 'roundedSquare';
  abbr: string;
  /** Icon path fill colour — defaults to 'white'. Use '#333' for transparent-bg icons. */
  iconColor?: string;
}

interface NodeConfigData {
  description: string;
  category: string;
  tier: string;
  configProps: Array<{ key: string; value: string }>;
  useCases: string[];
  docsUrl: string;
}

const SERVICE_TO_ICON: Record<string, AwsIconKey> = {
  lambda: 'lambda',
  s3: 's3',
  apigateway: 'apigateway',
  sqs: 'sqs',
  eventbridge: 'eventbridge',
  bedrock: 'bedrock',
  neptune: 'neptune',
  amplify: 'amplify',
  dynamodb: 'dynamodb',
  rds: 'rds',
  cloudfront: 'cloudfront',
  sns: 'sns',
  cognito: 'generic',
  ecs: 'generic',
  stepfunctions: 'generic',
  route53: 'generic',
  elb: 'generic',
  ec2: 'generic',
  eks: 'generic',
  kinesis: 'generic',
  internet: 'internet',
  generic: 'generic',
};

const AWS_SERVICE_CONFIG: Record<AWSServiceId, ServiceConfig> = {
  lambda:        { bg: '#FF9900', shape: 'circle',        abbr: 'λ'   },
  s3:            { bg: '#3F8624', shape: 'roundedSquare', abbr: 'S3'  },
  apigateway:    { bg: '#8C4FFF', shape: 'roundedSquare', abbr: 'API' },
  sqs:           { bg: '#FF4F8B', shape: 'roundedSquare', abbr: 'SQS' },
  eventbridge:   { bg: '#FF4F8B', shape: 'roundedSquare', abbr: 'EB'  },
  bedrock:       { bg: '#01A88D', shape: 'roundedSquare', abbr: 'BR'  },
  neptune:       { bg: '#7B16FF', shape: 'roundedSquare', abbr: 'NP'  },
  amplify:       { bg: '#FF4F8B', shape: 'roundedSquare', abbr: 'AMP' },
  dynamodb:      { bg: '#4053D6', shape: 'roundedSquare', abbr: 'DDB' },
  rds:           { bg: '#3F8624', shape: 'roundedSquare', abbr: 'RDS' },
  cloudfront:    { bg: '#FF9900', shape: 'roundedSquare', abbr: 'CF'  },
  cognito:       { bg: '#DD3522', shape: 'roundedSquare', abbr: 'CGN' },
  ecs:           { bg: '#FF9900', shape: 'roundedSquare', abbr: 'ECS' },
  sns:           { bg: '#FF4F8B', shape: 'roundedSquare', abbr: 'SNS' },
  stepfunctions: { bg: '#FF4F8B', shape: 'roundedSquare', abbr: 'SF'  },
  route53:       { bg: '#8C4FFF', shape: 'roundedSquare', abbr: 'R53' },
  elb:           { bg: '#8C4FFF', shape: 'roundedSquare', abbr: 'ELB' },
  ec2:           { bg: '#FF9900', shape: 'roundedSquare', abbr: 'EC2' },
  eks:           { bg: '#FF9900', shape: 'roundedSquare', abbr: 'EKS' },
  kinesis:       { bg: '#8C4FFF', shape: 'roundedSquare', abbr: 'KNS'            },
  internet:      { bg: 'none',    shape: 'roundedSquare', abbr: 'NET', iconColor: '#444' },
  generic:       { bg: '#545B64', shape: 'roundedSquare', abbr: '?'               },
};

const SERVICE_CONFIG_DATA: Partial<Record<AWSServiceId, NodeConfigData>> = {
  lambda: {
    description: 'Run code without provisioning or managing servers. Pay only for compute time.',
    category: 'Compute',
    tier: 'Serverless',
    configProps: [
      { key: 'Runtime', value: 'Node.js 20.x' },
      { key: 'Memory', value: '256 MB' },
      { key: 'Timeout', value: '30s' },
      { key: 'Concurrency', value: 'Unreserved' },
      { key: 'Invocation', value: 'Event-driven' },
    ],
    useCases: ['API backends', 'Event processing', 'Data transformation'],
    docsUrl: 'https://docs.aws.amazon.com/lambda',
  },
  s3: {
    description: 'Object storage built to store and retrieve any amount of data from anywhere.',
    category: 'Storage',
    tier: 'Managed',
    configProps: [
      { key: 'Storage class', value: 'Standard' },
      { key: 'Versioning', value: 'Enabled' },
      { key: 'Encryption', value: 'SSE-S3' },
      { key: 'Access', value: 'Private' },
      { key: 'Lifecycle', value: 'Configured' },
    ],
    useCases: ['Static hosting', 'Data lake', 'Backup & restore', 'Media storage'],
    docsUrl: 'https://docs.aws.amazon.com/s3',
  },
  apigateway: {
    description: 'Create, publish, and secure APIs at any scale. Supports REST, HTTP, and WebSocket.',
    category: 'Networking',
    tier: 'Managed',
    configProps: [
      { key: 'Type', value: 'REST API' },
      { key: 'Auth', value: 'Cognito User Pool' },
      { key: 'Stage', value: 'prod' },
      { key: 'Throttle', value: '1000 req/s' },
      { key: 'Cache', value: 'Disabled' },
    ],
    useCases: ['Microservices gateway', 'Lambda proxy', 'WebSocket APIs'],
    docsUrl: 'https://docs.aws.amazon.com/apigateway',
  },
  sqs: {
    description: 'Fully managed message queuing for microservices and distributed systems.',
    category: 'Messaging',
    tier: 'Serverless',
    configProps: [
      { key: 'Type', value: 'Standard' },
      { key: 'Visibility timeout', value: '30s' },
      { key: 'Message retention', value: '4 days' },
      { key: 'Max message size', value: '256 KB' },
      { key: 'DLQ', value: 'Configured' },
    ],
    useCases: ['Task queues', 'Load leveling', 'Decoupling services'],
    docsUrl: 'https://docs.aws.amazon.com/sqs',
  },
  eventbridge: {
    description: 'Serverless event bus that connects app data from your own apps and AWS services.',
    category: 'Messaging',
    tier: 'Serverless',
    configProps: [
      { key: 'Bus', value: 'Default' },
      { key: 'Schedule', value: 'cron(0 1 * * ? *)' },
      { key: 'Target', value: 'Lambda' },
      { key: 'Retry', value: '2 attempts' },
      { key: 'DLQ', value: 'Enabled' },
    ],
    useCases: ['Event-driven workflows', 'Scheduled tasks', 'Cross-account events'],
    docsUrl: 'https://docs.aws.amazon.com/eventbridge',
  },
  bedrock: {
    description: 'Fully managed service for accessing foundation models via a single API.',
    category: 'AI / ML',
    tier: 'Managed',
    configProps: [
      { key: 'Model', value: 'amazon.nova-pro-v1' },
      { key: 'Max tokens', value: '4096' },
      { key: 'Temperature', value: '0.7' },
      { key: 'Top-p', value: '0.9' },
      { key: 'Guardrails', value: 'Enabled' },
    ],
    useCases: ['Agents', 'RAG', 'Summarization', 'Code generation'],
    docsUrl: 'https://docs.aws.amazon.com/bedrock',
  },
  neptune: {
    description: 'Fast, reliable, fully managed graph database for highly connected datasets.',
    category: 'Database',
    tier: 'Managed',
    configProps: [
      { key: 'Engine', value: 'Neptune 1.3' },
      { key: 'Instance', value: 'db.r6g.large' },
      { key: 'Query language', value: 'Gremlin / SPARQL' },
      { key: 'Multi-AZ', value: 'Yes' },
      { key: 'Backup', value: '7 days' },
    ],
    useCases: ['Knowledge graphs', 'Fraud detection', 'Recommendation engines'],
    docsUrl: 'https://docs.aws.amazon.com/neptune',
  },
  amplify: {
    description: 'Build full-stack web and mobile apps with AWS. Includes hosting, auth, and data.',
    category: 'Frontend / Hosting',
    tier: 'Managed',
    configProps: [
      { key: 'Framework', value: 'Next.js' },
      { key: 'Branch', value: 'main' },
      { key: 'Build', value: 'Auto-deploy' },
      { key: 'CDN', value: 'CloudFront' },
      { key: 'Custom domain', value: 'Configured' },
    ],
    useCases: ['Static hosting', 'SSR apps', 'CI/CD pipelines'],
    docsUrl: 'https://docs.aws.amazon.com/amplify',
  },
  dynamodb: {
    description: 'Serverless, NoSQL, fully managed database with single-digit millisecond performance.',
    category: 'Database',
    tier: 'Serverless',
    configProps: [
      { key: 'Billing mode', value: 'On-demand' },
      { key: 'Replication', value: 'Single-region' },
      { key: 'TTL', value: 'Enabled' },
      { key: 'Streams', value: 'Enabled' },
      { key: 'Encryption', value: 'AWS-owned key' },
    ],
    useCases: ['Session stores', 'Leaderboards', 'Real-time apps'],
    docsUrl: 'https://docs.aws.amazon.com/dynamodb',
  },
  rds: {
    description: 'Managed relational database service for PostgreSQL, MySQL, and more.',
    category: 'Database',
    tier: 'Managed',
    configProps: [
      { key: 'Engine', value: 'PostgreSQL 16' },
      { key: 'Instance', value: 'db.t3.medium' },
      { key: 'Storage', value: '100 GB gp3' },
      { key: 'Multi-AZ', value: 'Yes' },
      { key: 'Backup', value: '7 days' },
    ],
    useCases: ['OLTP workloads', 'Application databases', 'Microservice backends'],
    docsUrl: 'https://docs.aws.amazon.com/rds',
  },
  cloudfront: {
    description: 'Fast, highly secure global content delivery network (CDN).',
    category: 'Networking',
    tier: 'Managed',
    configProps: [
      { key: 'Price class', value: 'All Edge Locations' },
      { key: 'Cache policy', value: 'CachingOptimized' },
      { key: 'HTTPS', value: 'Required' },
      { key: 'WAF', value: 'Attached' },
      { key: 'Geo restriction', value: 'None' },
    ],
    useCases: ['Static asset delivery', 'API acceleration', 'DDoS protection'],
    docsUrl: 'https://docs.aws.amazon.com/cloudfront',
  },
  cognito: {
    description: 'Add user sign-up, sign-in, and access control to your apps.',
    category: 'Security / Identity',
    tier: 'Managed',
    configProps: [
      { key: 'Pool type', value: 'User Pool' },
      { key: 'MFA', value: 'Optional TOTP' },
      { key: 'OAuth', value: 'Google, GitHub' },
      { key: 'Password policy', value: 'Strong' },
      { key: 'Token expiry', value: '1 hour' },
    ],
    useCases: ['User authentication', 'Social sign-in', 'Token vending'],
    docsUrl: 'https://docs.aws.amazon.com/cognito',
  },
  ecs: {
    description: 'Fully managed container orchestration service. Run Docker containers at scale.',
    category: 'Compute',
    tier: 'Container',
    configProps: [
      { key: 'Launch type', value: 'Fargate' },
      { key: 'CPU', value: '1 vCPU' },
      { key: 'Memory', value: '2 GB' },
      { key: 'Auto-scaling', value: 'Target tracking' },
      { key: 'Service mesh', value: 'App Mesh' },
    ],
    useCases: ['Microservices', 'Batch processing', 'Long-running tasks'],
    docsUrl: 'https://docs.aws.amazon.com/ecs',
  },
  sns: {
    description: 'Fully managed pub/sub messaging for application-to-person and app-to-app notifications.',
    category: 'Messaging',
    tier: 'Serverless',
    configProps: [
      { key: 'Type', value: 'Standard Topic' },
      { key: 'Protocol', value: 'Email / SQS / Lambda' },
      { key: 'Subscriptions', value: '3' },
      { key: 'Encryption', value: 'SSE-KMS' },
      { key: 'Delivery retry', value: 'Configured' },
    ],
    useCases: ['Fan-out messaging', 'Alerts', 'Mobile push notifications'],
    docsUrl: 'https://docs.aws.amazon.com/sns',
  },
  stepfunctions: {
    description: 'Visual workflow service to coordinate distributed applications using state machines.',
    category: 'Orchestration',
    tier: 'Serverless',
    configProps: [
      { key: 'Type', value: 'Standard Workflow' },
      { key: 'Max duration', value: '1 year' },
      { key: 'Logging', value: 'CloudWatch' },
      { key: 'X-Ray', value: 'Enabled' },
      { key: 'Error handling', value: 'Retry + Catch' },
    ],
    useCases: ['Workflow orchestration', 'ETL pipelines', 'Saga pattern'],
    docsUrl: 'https://docs.aws.amazon.com/step-functions',
  },
  route53: {
    description: 'Highly available and scalable cloud Domain Name System (DNS) web service.',
    category: 'Networking',
    tier: 'Managed',
    configProps: [
      { key: 'Routing policy', value: 'Latency-based' },
      { key: 'Health checks', value: 'Enabled' },
      { key: 'Failover', value: 'Active-Active' },
      { key: 'DNSSEC', value: 'Enabled' },
      { key: 'TTL', value: '60s' },
    ],
    useCases: ['DNS routing', 'Failover', 'Traffic management'],
    docsUrl: 'https://docs.aws.amazon.com/route53',
  },
  elb: {
    description: 'Distribute incoming traffic across multiple targets for high availability.',
    category: 'Networking',
    tier: 'Managed',
    configProps: [
      { key: 'Type', value: 'Application Load Balancer' },
      { key: 'Scheme', value: 'Internet-facing' },
      { key: 'Target', value: 'ECS Tasks' },
      { key: 'SSL policy', value: 'ELBSecurityPolicy-TLS13' },
      { key: 'Access logs', value: 'S3 Enabled' },
    ],
    useCases: ['Blue/green deploys', 'Multi-zone HA', 'Path-based routing'],
    docsUrl: 'https://docs.aws.amazon.com/elasticloadbalancing',
  },
  ec2: {
    description: 'Resizable compute capacity in the cloud. Launch virtual machines in minutes.',
    category: 'Compute',
    tier: 'IaaS',
    configProps: [
      { key: 'Instance type', value: 't3.medium' },
      { key: 'AMI', value: 'Amazon Linux 2023' },
      { key: 'Storage', value: '30 GB gp3' },
      { key: 'Auto Scaling', value: 'Min 1 / Max 5' },
      { key: 'Placement', value: 'Multi-AZ' },
    ],
    useCases: ['Custom runtimes', 'Lift-and-shift', 'Stateful workloads'],
    docsUrl: 'https://docs.aws.amazon.com/ec2',
  },
  eks: {
    description: 'Managed Kubernetes service to run Kubernetes without installing your own cluster.',
    category: 'Compute',
    tier: 'Container',
    configProps: [
      { key: 'Version', value: 'K8s 1.30' },
      { key: 'Node group', value: 'Managed' },
      { key: 'Instance type', value: 'm5.large' },
      { key: 'Nodes', value: '2–10 (auto-scale)' },
      { key: 'Add-ons', value: 'CoreDNS, kube-proxy' },
    ],
    useCases: ['Container orchestration', 'Microservices platform', 'ML workloads'],
    docsUrl: 'https://docs.aws.amazon.com/eks',
  },
  kinesis: {
    description: 'Collect, process, and analyze real-time streaming data at any scale.',
    category: 'Streaming',
    tier: 'Managed',
    configProps: [
      { key: 'Shards', value: '2' },
      { key: 'Retention', value: '24 hours' },
      { key: 'Enhanced fan-out', value: 'Enabled' },
      { key: 'Encryption', value: 'SSE-KMS' },
      { key: 'Consumer', value: 'Lambda' },
    ],
    useCases: ['Real-time analytics', 'Log ingestion', 'IoT data streams'],
    docsUrl: 'https://docs.aws.amazon.com/kinesis',
  },
  internet: {
    description: 'External internet traffic entering the system.',
    category: 'External',
    tier: 'External',
    configProps: [
      { key: 'Protocol', value: 'HTTPS' },
      { key: 'Auth', value: 'API Key / OAuth' },
    ],
    useCases: ['External API consumers', 'Public web traffic', 'Third-party integrations'],
    docsUrl: 'https://aws.amazon.com/architecture',
  },
  generic: {
    description: 'AWS service node.',
    category: 'AWS',
    tier: 'Managed',
    configProps: [],
    useCases: [],
    docsUrl: 'https://aws.amazon.com',
  },
};

/* ── Default Mock Data ───────────────────────────────────────────────────────── */

const DEFAULT_NODES: DrawIONode[] = [
  // ── Section labels ─────────────────────────────────────────────────────────
  { id: 'sec1', type: 'sectionLabel', x: 20,  y: 10,  label: 'Live Search' },
  { id: 'sec2', type: 'sectionLabel', x: 20,  y: 840, label: 'Job Search Batch Process' },
  { id: 'sec3', type: 'sectionLabel', x: 460, y: 840, label: 'Communication Batch Process' },

  // ── Live Search ────────────────────────────────────────────────────────────
  { id: 'users',    type: 'user',    x: 60,  y: 70,  label: 'Students' },
  { id: 'amplify',  type: 'service', x: 200, y: 140, label: 'AWS Amplify',  service: 'amplify' },
  { id: 'lambda1',  type: 'service', x: 340, y: 60,  label: 'Lambda', sublabel: 'Save Resume',    service: 'lambda' },
  { id: 's3_resume',type: 'service', x: 480, y: 20,  label: 'Amazon S3',    service: 's3' },
  { id: 'lambda2',  type: 'service', x: 340, y: 150, label: 'Lambda', sublabel: 'Resume Parser',  service: 'lambda' },
  { id: 'bedrock1', type: 'service', x: 490, y: 140, label: 'Nova Pro',      service: 'bedrock' },
  { id: 'lambda3',  type: 'service', x: 340, y: 240, label: 'Lambda', sublabel: 'Save Profile',   service: 'lambda' },
  { id: 'apigw',    type: 'service', x: 340, y: 325, label: 'API Gateway',   service: 'apigateway' },
  { id: 'lambda4',  type: 'service', x: 200, y: 390, label: 'Lambda',        service: 'lambda' },

  // ── Agentcore group ────────────────────────────────────────────────────────
  { id: 'g_agentcore', type: 'group', x: 28, y: 462, width: 600, height: 320, label: 'Agentcore', groupColor: '#8C4FFF' },
  { id: 'g_runtime',   type: 'group', x: 150, y: 492, width: 400, height: 270, label: 'Runtime',  groupColor: '#999' },

  { id: 'memory',       type: 'service', x: 55,  y: 520, label: 'Memory',             service: 'bedrock' },
  { id: 'observability',type: 'service', x: 55,  y: 665, label: 'Observability',       service: 'generic' },
  { id: 'routing',      type: 'service', x: 185, y: 575, label: 'Routing Agent',       service: 'bedrock' },
  { id: 'career',       type: 'service', x: 380, y: 510, label: 'Career Exploration Agent', service: 'bedrock' },
  { id: 'jobsearch',    type: 'service', x: 380, y: 650, label: 'Job Search Agent',    service: 'bedrock' },

  // ── Internet (globe) — above Tools ────────────────────────────────────────
  { id: 'internet',     type: 'service', x: 710, y: 250, label: 'Internet', service: 'internet' },

  // ── Tools group ────────────────────────────────────────────────────────────
  { id: 'g_tools', type: 'group', x: 660, y: 370, width: 320, height: 400, label: 'Tools', groupColor: '#8C4FFF' },

  { id: 'bedrock_kb',   type: 'service', x: 680, y: 420, label: 'Bedrock Knowledge Base', service: 'bedrock' },
  { id: 's3_vector',    type: 'service', x: 840, y: 420, label: 'S3 Vector store',        service: 's3' },
  { id: 'graphrag',     type: 'service', x: 680, y: 560, label: 'Graph RAG',              service: 'bedrock' },
  { id: 'neptune',      type: 'service', x: 840, y: 560, label: 'Neptune Graph',           service: 'neptune' },
  { id: 'student_info', type: 'service', x: 760, y: 680, label: 'Student Information',    service: 'dynamodb' },

  // ── Outside Tools (right side) ─────────────────────────────────────────────
  { id: 'career_res',   type: 'service', x: 1020, y: 300, label: 'career resources', service: 's3' },
  { id: 'job_postings', type: 'service', x: 1020, y: 550, label: 'Job Postings',     service: 's3' },

  // ── Job Search Batch Process ───────────────────────────────────────────────
  { id: 'lambda_pq', type: 'service', x: 170, y: 870,  label: 'Lambda', sublabel: 'Process Queue',      service: 'lambda' },
  { id: 'sqs',       type: 'service', x: 170, y: 970,  label: 'Amazon SQS',                              service: 'sqs' },
  { id: 'lambda_q',  type: 'service', x: 55,  y: 970,  label: 'Lambda', sublabel: 'Add to Queue',       service: 'lambda' },
  { id: 'eb1',       type: 'service', x: 55,  y: 1070, label: 'EventBridge', sublabel: 'trigger 1am everyday (Time Configurable)', service: 'eventbridge' },

  // ── Communication Batch Process ────────────────────────────────────────────
  { id: 'lambda_dn', type: 'service', x: 490, y: 870,  label: 'Lambda', sublabel: 'Send Daily Notifications', service: 'lambda' },
  { id: 'ses',       type: 'service', x: 680, y: 850,  label: 'Simple Email Service',                    service: 'sns' },
  { id: 'pinpoint',  type: 'service', x: 680, y: 950,  label: 'End User Messaging',                      service: 'sns' },
  { id: 'eb2',       type: 'service', x: 490, y: 1070, label: 'EventBridge', sublabel: 'trigger 9am everyday (Time Configurable)', service: 'eventbridge' },
];

const DEFAULT_EDGES: DrawIOEdge[] = [
  // Live Search
  { from: 'users',    to: 'amplify' },
  { from: 'amplify',  to: 'lambda1',   label: 'Save Resume' },
  { from: 'amplify',  to: 'lambda2',   label: 'S3 Path' },
  { from: 'amplify',  to: 'lambda3',   label: 'Save Profile' },
  { from: 'amplify',  to: 'apigw',     label: 'Job Notification Result' },
  { from: 'lambda1',  to: 's3_resume' },
  { from: 'lambda2',  to: 'bedrock1',  label: 'Resume Parser' },
  { from: 'amplify',  to: 'lambda4' },
  { from: 'lambda4',  to: 'routing' },

  // Agentcore routing
  { from: 'routing',  to: 'career' },
  { from: 'routing',  to: 'jobsearch' },
  { from: 'routing',  to: 'memory' },
  { from: 'routing',  to: 'observability' },

  // Tools connections
  { from: 'career',      to: 'bedrock_kb' },
  { from: 'jobsearch',   to: 'graphrag' },
  { from: 'bedrock_kb',  to: 's3_vector' },
  { from: 'graphrag',    to: 'neptune' },

  // Right-side external nodes
  { from: 'career',      to: 'career_res' },
  { from: 'neptune',     to: 'job_postings' },

  // Internet (dashed — external traffic into Tools)
  { from: 'internet',    to: 'bedrock_kb', dashed: true },

  // Student Information (shared store)
  { from: 'jobsearch',   to: 'student_info' },
  { from: 'lambda_pq',   to: 'student_info' },
  { from: 'lambda_dn',   to: 'student_info' },

  // Job Search Batch
  { from: 'eb1',       to: 'lambda_q' },
  { from: 'lambda_q',  to: 'sqs' },
  { from: 'sqs',       to: 'lambda_pq' },

  // Communication Batch
  { from: 'eb2',       to: 'lambda_dn' },
  { from: 'lambda_dn', to: 'ses' },
  { from: 'lambda_dn', to: 'pinpoint' },
];

/* ── Backward Compatibility Converters ──────────────────────────────────────── */

function mapForgeTypeToService(type: ForgeArchNode['type']): AWSServiceId {
  const map: Record<ForgeArchNode['type'], AWSServiceId> = {
    compute: 'lambda',
    storage: 's3',
    cache: 'dynamodb',
    gateway: 'apigateway',
    queue: 'sqs',
    auth: 'cognito',
  };
  return map[type] ?? 'generic';
}

export function convertForgeNodes(forgeNodes: ForgeArchNode[]): DrawIONode[] {
  return forgeNodes.map((n, i) => ({
    id: n.id,
    type: 'service' as const,
    x: n.x ?? (i % 4) * 180 + 40,
    y: n.y ?? Math.floor(i / 4) * 160 + 40,
    label: n.label,
    sublabel: n.sublabel,
    service: mapForgeTypeToService(n.type),
  }));
}

export function convertForgeEdges(forgeEdges: ForgeArchEdge[]): DrawIOEdge[] {
  return forgeEdges.map((e) => ({
    from: e.from,
    to: e.to,
  }));
}

/* ── Helper ──────────────────────────────────────────────────────────────────── */

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Tooltip DOM Component ───────────────────────────────────────────────────── */

interface TooltipState {
  node: DrawIONode;
  x: number;
  y: number;
}

function NodeTooltip({ state }: { state: TooltipState }) {
  const service = state.node.service ?? 'generic';
  const config = SERVICE_CONFIG_DATA[service];
  const serviceConf = AWS_SERVICE_CONFIG[service];

  return (
    <div
      style={{
        position: 'fixed',
        left: state.x + 14,
        top: state.y - 8,
        zIndex: 1000,
        pointerEvents: 'none',
        background: '#1a1a2e',
        border: `1px solid ${serviceConf.bg}40`,
        borderLeft: `3px solid ${serviceConf.bg}`,
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 200,
        maxWidth: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            background: serviceConf.bg,
            borderRadius: serviceConf.shape === 'circle' ? '50%' : 4,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            color: 'white',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {serviceConf.abbr.slice(0, 2)}
        </span>
        <span style={{ color: '#ffffff', fontWeight: 600, fontSize: 12, fontFamily: 'Arial, sans-serif' }}>
          {state.node.label}
        </span>
      </div>
      {state.node.sublabel && (
        <div style={{ color: serviceConf.bg, fontSize: 11, marginBottom: 4, fontFamily: 'Arial, sans-serif' }}>
          {state.node.sublabel}
        </div>
      )}
      {config && (
        <div style={{ color: '#aaaacc', fontSize: 11, lineHeight: 1.4, fontFamily: 'Arial, sans-serif' }}>
          {config.description}
        </div>
      )}
      <div style={{ marginTop: 6, color: '#888', fontSize: 10, fontFamily: 'monospace' }}>
        Click to view config →
      </div>
    </div>
  );
}

/* ── Config Side Panel ───────────────────────────────────────────────────────── */

interface ConfigPanelProps {
  node: DrawIONode;
  onClose: () => void;
}

function ConfigPanel({ node, onClose }: ConfigPanelProps) {
  const service = node.service ?? 'generic';
  const serviceConf = AWS_SERVICE_CONFIG[service];
  const configData = SERVICE_CONFIG_DATA[service];

  // Merge node-level config overrides with defaults; overrides win on duplicate keys
  const configPropsMap = new Map<string, string>(
    (configData?.configProps ?? []).map(({ key, value }) => [key, value]),
  );
  for (const [key, value] of Object.entries(node.config ?? {})) {
    configPropsMap.set(key, value);
  }
  const configProps = Array.from(configPropsMap, ([key, value]) => ({ key, value }));

  const tierColors: Record<string, string> = {
    Serverless: '#01A88D',
    Managed: '#4053D6',
    Container: '#FF9900',
    IaaS: '#545B64',
    Streaming: '#8C4FFF',
    Orchestration: '#FF4F8B',
    'AI / ML': '#01A88D',
    'Security / Identity': '#DD3522',
    'Frontend / Hosting': '#FF4F8B',
    Database: '#4053D6',
  };

  const tierColor = tierColors[configData?.tier ?? ''] ?? '#545B64';

  return (
    <div
      style={{
        width: 300,
        minWidth: 300,
        height: '100%',
        background: '#0f0f1a',
        borderLeft: `1px solid ${serviceConf.bg}30`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: `1px solid ${serviceConf.bg}25`,
          background: `linear-gradient(135deg, ${serviceConf.bg}18, transparent)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: serviceConf.bg,
                borderRadius: serviceConf.shape === 'circle' ? '50%' : 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'white', fontWeight: 700, fontSize: 11 }}>
                {serviceConf.abbr}
              </span>
            </div>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                {node.label}
              </div>
              {node.sublabel && (
                <div style={{ color: serviceConf.bg, fontSize: 11, marginTop: 2 }}>
                  {node.sublabel}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close config panel"
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 4px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Category + Tier badges */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {configData?.category && (
            <span
              style={{
                background: `${serviceConf.bg}22`,
                color: serviceConf.bg,
                border: `1px solid ${serviceConf.bg}44`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {configData.category}
            </span>
          )}
          {configData?.tier && (
            <span
              style={{
                background: `${tierColor}22`,
                color: tierColor,
                border: `1px solid ${tierColor}44`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {configData.tier}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* Description */}
        {configData?.description && (
          <p style={{ color: '#aaaacc', fontSize: 12, lineHeight: 1.5, margin: '0 0 16px' }}>
            {node.description ?? configData.description}
          </p>
        )}

        {/* Config Properties */}
        {configProps.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <h4 style={{ color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
              Configuration
            </h4>
            <div
              style={{
                background: '#ffffff08',
                border: '1px solid #ffffff12',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {configProps.map(({ key, value }, i) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderBottom: i < configProps.length - 1 ? '1px solid #ffffff0a' : 'none',
                  }}
                >
                  <span style={{ color: '#888', fontSize: 11 }}>{key}</span>
                  <span
                    style={{
                      color: '#dde',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      background: '#ffffff0a',
                      padding: '1px 6px',
                      borderRadius: 3,
                      maxWidth: 140,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Use Cases */}
        {configData?.useCases && configData.useCases.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <h4 style={{ color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
              Use Cases
            </h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {configData.useCases.map((uc) => (
                <li
                  key={uc}
                  style={{
                    color: '#aaaacc',
                    fontSize: 12,
                    padding: '3px 0 3px 14px',
                    position: 'relative',
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 7,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: serviceConf.bg,
                    }}
                  />
                  {uc}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Node ID (useful for debugging / referencing) */}
        <section>
          <h4 style={{ color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
            Node ID
          </h4>
          <code
            style={{
              color: '#666',
              fontSize: 11,
              background: '#ffffff08',
              border: '1px solid #ffffff0f',
              borderRadius: 4,
              padding: '4px 8px',
              display: 'block',
            }}
          >
            {node.id}
          </code>
        </section>
      </div>

      {/* Footer */}
      {configData?.docsUrl && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #ffffff10' }}>
          <a
            href={configData.docsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: serviceConf.bg,
              fontSize: 12,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <span>AWS Documentation</span>
            <span style={{ fontSize: 10 }}>↗</span>
          </a>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function GroupContainer({ node }: { node: DrawIONode }) {
  const color = node.groupColor ?? '#8C4FFF';
  const labelWidth = node.label.length * 7 + 16;

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.width ?? 200}
        height={node.height ?? 150}
        rx={6}
        ry={6}
        fill={hexToRgba(color, 0.03)}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <rect
        x={node.x + 8}
        y={node.y - 10}
        width={labelWidth}
        height={20}
        rx={3}
        fill="white"
        stroke={color}
        strokeWidth={1}
      />
      <text
        x={node.x + 16}
        y={node.y + 5}
        fill={color}
        fontSize={11}
        fontFamily="monospace"
        fontWeight="600"
      >
        {node.label}
      </text>
    </g>
  );
}

interface ServiceNodeProps {
  node: DrawIONode;
  iconSize: number;
  isSelected: boolean;
  onSelect: (node: DrawIONode) => void;
  onHover: (node: DrawIONode, x: number, y: number) => void;
  onLeave: () => void;
}

function ServiceNode({ node, iconSize, isSelected, onSelect, onHover, onLeave }: ServiceNodeProps) {
  const cx = node.x + iconSize / 2;

  if (node.type === 'user') {
    const icon = AWS_ICONS.users;
    const scale = iconSize / 48;
    return (
      <g
        role="button"
        aria-label={node.label}
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(node)}
        onMouseEnter={(e) => onHover(node, e.clientX, e.clientY)}
        onMouseMove={(e) => onHover(node, e.clientX, e.clientY)}
        onMouseLeave={onLeave}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(node); }}
      >
        {isSelected && (
          <circle
            cx={cx}
            cy={node.y + iconSize / 2}
            r={iconSize / 2 + 6}
            fill="none"
            stroke="#8C4FFF"
            strokeWidth={2}
            strokeDasharray="4,3"
          />
        )}
        <g transform={`translate(${node.x}, ${node.y}) scale(${scale})`}>
          <g transform={icon.glyphTransform}>
            <path d={icon.path} fill="#555555" />
          </g>
        </g>
        <text
          x={cx}
          y={node.y + iconSize + 14}
          textAnchor="middle"
          fill="#222"
          fontSize={11}
          fontFamily="Arial, sans-serif"
        >
          {node.label}
        </text>
      </g>
    );
  }

  const service = node.service ?? 'generic';
  const config = AWS_SERVICE_CONFIG[service];
  const iconKey = SERVICE_TO_ICON[service] ?? 'generic';
  const icon = AWS_ICONS[iconKey];
  const [vbW, vbH] = icon.viewBox.split(' ').slice(2).map(Number);
  const scale = iconSize / Math.max(vbW, vbH);

  return (
    <g
      role="button"
      aria-label={`${node.label}${node.sublabel ? ` — ${node.sublabel}` : ''}`}
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(node)}
      onMouseEnter={(e) => onHover(node, e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(node, e.clientX, e.clientY)}
      onMouseLeave={onLeave}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(node); }}
    >
      {/* Selection ring */}
      {isSelected && (
        <rect
          x={node.x - 5}
          y={node.y - 5}
          width={iconSize + 10}
          height={iconSize + 10}
          rx={12}
          fill="none"
          stroke={config.bg}
          strokeWidth={2}
          strokeDasharray="4,3"
          opacity={0.9}
        />
      )}
      {/* Background shape */}
      {config.shape === 'circle' ? (
        <circle
          cx={cx}
          cy={node.y + iconSize / 2}
          r={iconSize / 2}
          fill={config.bg}
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={iconSize}
          height={iconSize}
          rx={8}
          fill={config.bg}
        />
      )}
      {/* Real AWS icon path scaled to fit iconSize */}
      <g transform={`translate(${node.x}, ${node.y}) scale(${scale})`}>
        <g transform={icon.glyphTransform}>
          <path d={icon.path} fill={config.iconColor ?? 'white'} />
        </g>
      </g>
      {/* Primary label */}
      <text
        x={cx}
        y={node.y + iconSize + 14}
        textAnchor="middle"
        fill="#222"
        fontSize={11}
        fontFamily="Arial, sans-serif"
        fontWeight="600"
      >
        {node.label}
      </text>
      {/* Sublabel */}
      {node.sublabel && (
        <text
          x={cx}
          y={node.y + iconSize + 27}
          textAnchor="middle"
          fill="#666"
          fontSize={10}
          fontFamily="Arial, sans-serif"
        >
          {node.sublabel}
        </text>
      )}
    </g>
  );
}

function DiagramEdge({
  edge,
  nodeMap,
  iconSize,
}: {
  edge: DrawIOEdge;
  nodeMap: Map<string, DrawIONode>;
  iconSize: number;
}) {
  const fromNode = nodeMap.get(edge.from);
  const toNode = nodeMap.get(edge.to);
  if (!fromNode || !toNode) return null;

  const getCenter = (n: DrawIONode): [number, number] => {
    if (n.type === 'group') {
      return [n.x + (n.width ?? 200) / 2, n.y + (n.height ?? 150) / 2];
    }
    return [n.x + iconSize / 2, n.y + iconSize / 2];
  };

  const [x1, y1] = getCenter(fromNode);
  const [x2, y2] = getCenter(toNode);
  const my = (y1 + y2) / 2;
  const mx = (x1 + x2) / 2;
  const d = `M ${x1},${y1} C ${x1},${my} ${x2},${my} ${x2},${y2}`;

  return (
    <g>
      <path
        d={d}
        stroke={edge.dashed ? '#666' : '#333'}
        strokeWidth={1.5}
        fill="none"
        strokeDasharray={edge.dashed ? '5,4' : undefined}
        markerEnd={edge.dashed ? 'url(#arrow-dashed)' : 'url(#arrow-dark)'}
        strokeLinecap="round"
      />
      {edge.label && (
        <text
          x={mx}
          y={my - 4}
          textAnchor="middle"
          fill="#555"
          fontSize={10}
          fontFamily="Arial, sans-serif"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

function SectionLabel({ node }: { node: DrawIONode }) {
  return (
    <text
      x={node.x}
      y={node.y + 28}
      fontSize={24}
      fontWeight={700}
      fill="#1a1a1a"
      fontFamily="Arial, sans-serif"
      opacity={0.85}
    >
      {node.label}
    </text>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────────── */

export default function ArchDiagram({
  nodes: propNodes,
  edges: propEdges,
  onNodeSelect,
  selectedNodeId: controlledSelectedNodeId,
}: ArchDiagramProps) {
  const nodes = propNodes ?? DEFAULT_NODES;
  const edges = propEdges ?? DEFAULT_EDGES;

  // Controlled mode: parent owns selection; uncontrolled: internal state + ConfigPanel
  const isControlled = onNodeSelect !== undefined;

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const ICON_SIZE = 56;
  const PAD = 60;

  const selectedNodeId = isControlled ? (controlledSelectedNodeId ?? null) : internalSelectedId;
  // ConfigPanel only shown in uncontrolled mode (parent provides its own inspector)
  const selectedNode = !isControlled && selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const handleSelect = useCallback((node: DrawIONode) => {
    if (isControlled) {
      onNodeSelect(node.id === (controlledSelectedNodeId ?? null) ? null : node.id);
    } else {
      setInternalSelectedId((prev) => (prev === node.id ? null : node.id));
    }
    setTooltip(null);
  }, [isControlled, onNodeSelect, controlledSelectedNodeId]);

  const handleHover = useCallback((node: DrawIONode, x: number, y: number) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltip((prev) => (prev?.node.id === node.id ? { node, x, y } : prev));
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({ node, x, y });
    }, 250);
  }, []);

  const handleLeave = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltip(null);
  }, []);

  const serviceNodes = nodes.filter(
    (n) => n.type !== 'group' && n.type !== 'sectionLabel',
  );

  const maxX =
    serviceNodes.length > 0
      ? Math.max(...serviceNodes.map((n) => n.x + ICON_SIZE))
      : 800;

  const allNodes = nodes.filter((n) => n.type !== 'sectionLabel');
  const maxY =
    allNodes.length > 0
      ? Math.max(
          ...allNodes.map((n) => n.y + (n.height ?? ICON_SIZE) + 30),
        )
      : 600;

  const svgWidth = Math.max(maxX + PAD, 800);
  const svgHeight = Math.max(maxY + PAD, 600);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ariaLabel = [
    'AWS architecture diagram.',
    nodes
      .filter((n) => n.type === 'service' || n.type === 'user')
      .map((n) => n.label)
      .join(', '),
    'Connections:',
    edges
      .map((e) => {
        const from = nodeMap.get(e.from)?.label ?? e.from;
        const to = nodeMap.get(e.to)?.label ?? e.to;
        return `${from} to ${to}`;
      })
      .join(', '),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        background: '#FAFAFA',
        borderRadius: '12px',
        position: 'relative',
      }}
      aria-label={ariaLabel}
    >
      {/* SVG diagram — shrinks when panel is open */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minWidth: 0,
          transition: 'flex 0.25s ease',
        }}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', minWidth: '100%' }}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="arrow-dark"
              markerWidth={8}
              markerHeight={6}
              refX={7}
              refY={3}
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#333" />
            </marker>
            <marker
              id="arrow-dashed"
              markerWidth={8}
              markerHeight={6}
              refX={7}
              refY={3}
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#666" />
            </marker>
          </defs>

          {/* Layer 1: Group containers */}
          {nodes
            .filter((n) => n.type === 'group')
            .map((node) => (
              <GroupContainer key={node.id} node={node} />
            ))}

          {/* Layer 2: Edges */}
          {edges.map((edge, i) => (
            <DiagramEdge
              key={`${edge.from}-${edge.to}-${i}`}
              edge={edge}
              nodeMap={nodeMap}
              iconSize={ICON_SIZE}
            />
          ))}

          {/* Layer 3: Service and user nodes */}
          {nodes
            .filter((n) => n.type === 'service' || n.type === 'user')
            .map((node) => (
              <ServiceNode
                key={node.id}
                node={node}
                iconSize={ICON_SIZE}
                isSelected={node.id === selectedNodeId}
                onSelect={handleSelect}
                onHover={handleHover}
                onLeave={handleLeave}
              />
            ))}

          {/* Layer 4: Section labels */}
          {nodes
            .filter((n) => n.type === 'sectionLabel')
            .map((node) => (
              <SectionLabel key={node.id} node={node} />
            ))}
        </svg>
      </div>

      {/* Config side panel */}
      {selectedNode && selectedNode.type !== 'sectionLabel' && (
        <ConfigPanel
          node={selectedNode}
          onClose={() => setInternalSelectedId(null)}
        />
      )}

      {/* Tooltip — portalled to document.body to escape any parent transform/overflow */}
      {mounted && tooltip && !selectedNodeId &&
        createPortal(<NodeTooltip state={tooltip} />, document.body)
      }
    </div>
  );
}
