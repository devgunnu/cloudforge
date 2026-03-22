'use client';

import type { ForgeArchNode, ForgeArchEdge } from '@/store/forgeStore';

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
}

/* ── AWS Service Config ──────────────────────────────────────────────────────── */

interface ServiceConfig {
  bg: string;
  shape: 'circle' | 'roundedSquare';
  abbr: string;
  iconContent: string;
}

const AWS_SERVICE_CONFIG: Record<AWSServiceId, ServiceConfig> = {
  lambda: {
    bg: '#FF9900',
    shape: 'circle',
    abbr: 'λ',
    iconContent: `<text x="28" y="38" text-anchor="middle" fill="white" font-size="28" font-family="Georgia, serif" font-weight="bold">λ</text>`,
  },
  s3: {
    bg: '#3F8624',
    shape: 'roundedSquare',
    abbr: 'S3',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="16" font-family="Arial, sans-serif" font-weight="bold">S3</text>`,
  },
  apigateway: {
    bg: '#8C4FFF',
    shape: 'roundedSquare',
    abbr: 'API',
    iconContent: `<text x="28" y="32" text-anchor="middle" fill="white" font-size="12" font-family="monospace" font-weight="bold">&lt;/&gt;</text>`,
  },
  sqs: {
    bg: '#232F3E',
    shape: 'roundedSquare',
    abbr: 'SQS',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="13" font-family="Arial, sans-serif" font-weight="bold">SQS</text>`,
  },
  eventbridge: {
    bg: '#FF4F8B',
    shape: 'roundedSquare',
    abbr: 'EB',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="10" font-family="Arial, sans-serif" font-weight="bold">Event</text>`,
  },
  bedrock: {
    bg: '#01A88D',
    shape: 'roundedSquare',
    abbr: 'BR',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif" font-weight="bold">Bedrock</text>`,
  },
  neptune: {
    bg: '#7B16FF',
    shape: 'roundedSquare',
    abbr: 'NP',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="10" font-family="Arial, sans-serif" font-weight="bold">Neptune</text>`,
  },
  amplify: {
    bg: '#FF4F8B',
    shape: 'roundedSquare',
    abbr: 'AMP',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif" font-weight="bold">Amplify</text>`,
  },
  dynamodb: {
    bg: '#4053D6',
    shape: 'roundedSquare',
    abbr: 'DDB',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif" font-weight="bold">DDB</text>`,
  },
  rds: {
    bg: '#3F8624',
    shape: 'roundedSquare',
    abbr: 'RDS',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">RDS</text>`,
  },
  cloudfront: {
    bg: '#FF9900',
    shape: 'roundedSquare',
    abbr: 'CF',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">CF</text>`,
  },
  cognito: {
    bg: '#DD3522',
    shape: 'roundedSquare',
    abbr: 'CGN',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif" font-weight="bold">Cognito</text>`,
  },
  ecs: {
    bg: '#FF9900',
    shape: 'roundedSquare',
    abbr: 'ECS',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">ECS</text>`,
  },
  sns: {
    bg: '#FF4F8B',
    shape: 'roundedSquare',
    abbr: 'SNS',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">SNS</text>`,
  },
  stepfunctions: {
    bg: '#FF4F8B',
    shape: 'roundedSquare',
    abbr: 'SF',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif" font-weight="bold">Step Fn</text>`,
  },
  route53: {
    bg: '#8C4FFF',
    shape: 'roundedSquare',
    abbr: 'R53',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">R53</text>`,
  },
  elb: {
    bg: '#8C4FFF',
    shape: 'roundedSquare',
    abbr: 'ELB',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">ELB</text>`,
  },
  ec2: {
    bg: '#FF9900',
    shape: 'roundedSquare',
    abbr: 'EC2',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">EC2</text>`,
  },
  eks: {
    bg: '#FF9900',
    shape: 'roundedSquare',
    abbr: 'EKS',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif" font-weight="bold">EKS</text>`,
  },
  kinesis: {
    bg: '#8C4FFF',
    shape: 'roundedSquare',
    abbr: 'KNS',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif" font-weight="bold">Kinesis</text>`,
  },
  generic: {
    bg: '#545B64',
    shape: 'roundedSquare',
    abbr: '?',
    iconContent: `<text x="28" y="36" text-anchor="middle" fill="white" font-size="20" font-family="Arial, sans-serif" font-weight="bold">?</text>`,
  },
};

/* ── Default Mock Data ───────────────────────────────────────────────────────── */

const DEFAULT_NODES: DrawIONode[] = [
  { id: 'sec1', type: 'sectionLabel', x: 20, y: 10, label: 'Live Search' },
  { id: 'users', type: 'user', x: 60, y: 60, label: 'Students' },
  { id: 'amplify', type: 'service', x: 200, y: 130, label: 'AWS Amplify', service: 'amplify' },
  { id: 'lambda1', type: 'service', x: 340, y: 60, label: 'Lambda', sublabel: 'Save Resume', service: 'lambda' },
  { id: 's3', type: 'service', x: 480, y: 20, label: 'Amazon S3', service: 's3' },
  { id: 'lambda2', type: 'service', x: 340, y: 140, label: 'Lambda', sublabel: 'Resume Parser', service: 'lambda' },
  { id: 'bedrock1', type: 'service', x: 490, y: 130, label: 'Nova Pro', service: 'bedrock' },
  { id: 'lambda3', type: 'service', x: 340, y: 220, label: 'Lambda', sublabel: 'Save Profile', service: 'lambda' },
  { id: 'apigw', type: 'service', x: 340, y: 300, label: 'API Gateway', service: 'apigateway' },
  { id: 'lambda4', type: 'service', x: 200, y: 360, label: 'Lambda', service: 'lambda' },
  { id: 'g_agentcore', type: 'group', x: 30, y: 440, width: 560, height: 280, label: 'Agentcore', groupColor: '#8C4FFF' },
  { id: 'g_runtime', type: 'group', x: 140, y: 470, width: 360, height: 240, label: 'Runtime', groupColor: '#999' },
  { id: 'routing', type: 'service', x: 170, y: 530, label: 'Routing Agent', service: 'bedrock' },
  { id: 'career', type: 'service', x: 330, y: 490, label: 'Career Exploration Agent', service: 'bedrock' },
  { id: 'jobsearch', type: 'service', x: 330, y: 600, label: 'Job Search Agent', service: 'bedrock' },
  { id: 'memory', type: 'service', x: 60, y: 510, label: 'Memory', service: 'bedrock' },
  { id: 'g_tools', type: 'group', x: 620, y: 340, width: 300, height: 360, label: 'Tools', groupColor: '#8C4FFF' },
  { id: 'bedrock_kb', type: 'service', x: 640, y: 390, label: 'Bedrock Knowledge Base', service: 'bedrock' },
  { id: 's3_vector', type: 'service', x: 780, y: 390, label: 'S3 Vector store', service: 's3' },
  { id: 'graphrag', type: 'service', x: 640, y: 520, label: 'Graph RAG', service: 'bedrock' },
  { id: 'neptune', type: 'service', x: 780, y: 520, label: 'Neptune Graph', service: 'neptune' },
  { id: 'sec2', type: 'sectionLabel', x: 20, y: 760, label: 'Job Search Batch Process' },
  { id: 'eb1', type: 'service', x: 80, y: 860, label: 'EventBridge', sublabel: 'trigger 1am', service: 'eventbridge' },
  { id: 'lambda_q', type: 'service', x: 80, y: 750, label: 'Lambda', sublabel: 'Add to Queue', service: 'lambda' },
  { id: 'sqs', type: 'service', x: 200, y: 800, label: 'Amazon SQS', service: 'sqs' },
  { id: 'lambda_pq', type: 'service', x: 200, y: 700, label: 'Lambda', sublabel: 'Process Queue', service: 'lambda' },
  { id: 'sec3', type: 'sectionLabel', x: 440, y: 760, label: 'Communication Batch Process' },
  { id: 'eb2', type: 'service', x: 450, y: 860, label: 'EventBridge', sublabel: 'trigger 9am', service: 'eventbridge' },
  { id: 'lambda_dn', type: 'service', x: 450, y: 750, label: 'Lambda', sublabel: 'Send Daily Notifications', service: 'lambda' },
  { id: 'ses', type: 'service', x: 620, y: 720, label: 'Simple Email Service', service: 'sns' },
  { id: 'pinpoint', type: 'service', x: 620, y: 820, label: 'End User Messaging', service: 'sns' },
];

const DEFAULT_EDGES: DrawIOEdge[] = [
  { from: 'users', to: 'amplify' },
  { from: 'amplify', to: 'lambda1', label: 'Save Resume' },
  { from: 'amplify', to: 'lambda2', label: 'S3 Path' },
  { from: 'amplify', to: 'lambda3', label: 'Save Profile' },
  { from: 'amplify', to: 'apigw', label: 'Job Notification' },
  { from: 'lambda1', to: 's3' },
  { from: 'lambda2', to: 'bedrock1', label: 'Resume Parser' },
  { from: 'amplify', to: 'lambda4' },
  { from: 'lambda4', to: 'routing' },
  { from: 'routing', to: 'career' },
  { from: 'routing', to: 'jobsearch' },
  { from: 'routing', to: 'memory' },
  { from: 'career', to: 'bedrock_kb' },
  { from: 'jobsearch', to: 'graphrag' },
  { from: 'bedrock_kb', to: 's3_vector' },
  { from: 'graphrag', to: 'neptune' },
  { from: 'eb1', to: 'lambda_q' },
  { from: 'lambda_q', to: 'sqs' },
  { from: 'sqs', to: 'lambda_pq' },
  { from: 'eb2', to: 'lambda_dn' },
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

function ServiceNode({ node, iconSize }: { node: DrawIONode; iconSize: number }) {
  if (node.type === 'user') {
    const cx = node.x + iconSize / 2;
    const cy = node.y + 16;
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="none"
          stroke="#555"
          strokeWidth={2}
        />
        <path
          d={`M ${cx - 18} ${cy + 30} Q ${cx} ${cy + 14} ${cx + 18} ${cy + 30}`}
          fill="none"
          stroke="#555"
          strokeWidth={2}
        />
        <text
          x={cx}
          y={node.y + iconSize + 18}
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
  const cx = node.x + iconSize / 2;

  return (
    <g>
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
      {/* Icon inner content rendered via a nested SVG to scope the coordinate system */}
      <svg
        x={node.x}
        y={node.y}
        width={iconSize}
        height={iconSize}
        viewBox="0 0 56 56"
        overflow="visible"
      >
        <g dangerouslySetInnerHTML={{ __html: config.iconContent }} />
      </svg>
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
  nodes,
  iconSize,
}: {
  edge: DrawIOEdge;
  nodes: DrawIONode[];
  iconSize: number;
}) {
  const fromNode = nodes.find((n) => n.id === edge.from);
  const toNode = nodes.find((n) => n.id === edge.to);
  if (!fromNode || !toNode) return null;

  const getCenter = (n: DrawIONode): [number, number] => {
    if (n.type === 'group') {
      return [n.x + (n.width ?? 200) / 2, n.y + (n.height ?? 150) / 2];
    }
    if (n.type === 'user') {
      return [n.x + iconSize / 2, n.y + iconSize / 2];
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

export default function ArchDiagram({ nodes: propNodes, edges: propEdges }: ArchDiagramProps) {
  const nodes = propNodes ?? DEFAULT_NODES;
  const edges = propEdges ?? DEFAULT_EDGES;

  const ICON_SIZE = 56;
  const PAD = 60;

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

  /* Accessible aria label */
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
        overflow: 'auto',
        background: '#FAFAFA',
        borderRadius: '12px',
      }}
      role="img"
      aria-label={ariaLabel}
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

        {/* Layer 1: Group containers — rendered behind everything */}
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
            nodes={nodes}
            iconSize={ICON_SIZE}
          />
        ))}

        {/* Layer 3: Service and user nodes */}
        {nodes
          .filter((n) => n.type === 'service' || n.type === 'user')
          .map((node) => (
            <ServiceNode key={node.id} node={node} iconSize={ICON_SIZE} />
          ))}

        {/* Layer 4: Section labels — on top */}
        {nodes
          .filter((n) => n.type === 'sectionLabel')
          .map((node) => (
            <SectionLabel key={node.id} node={node} />
          ))}
      </svg>
    </div>
  );
}
