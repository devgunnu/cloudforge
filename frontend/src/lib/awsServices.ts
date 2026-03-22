import {
  Globe,
  Zap,
  HardDrive,
  Database,
  Server,
  Network,
  Shield,
  Lock,
  BarChart,
  Cloud,
  type LucideIcon,
} from 'lucide-react';

export type ServiceCategory =
  | 'Compute'
  | 'Storage'
  | 'Database'
  | 'Networking'
  | 'CDN'
  | 'Security'
  | 'Cache'
  | 'Messaging';

export interface AWSServiceDefinition {
  id: string;
  label: string;
  category: ServiceCategory;
  description: string;
  icon: LucideIcon;
  color: string;
  defaultConfig: Record<string, unknown>;
}

export const awsServices: Record<string, AWSServiceDefinition> = {
  'api-gateway': {
    id: 'api-gateway',
    label: 'API Gateway',
    category: 'Networking',
    description: 'Managed REST / HTTP / WebSocket APIs',
    icon: Globe,
    color: 'var(--cf-text-primary)',
    defaultConfig: {
      name: 'my-api',
      stage: 'prod',
      type: 'REST',
      throttlingRateLimit: 10000,
      throttlingBurstLimit: 5000,
    },
  },
  lambda: {
    id: 'lambda',
    label: 'Lambda',
    category: 'Compute',
    description: 'Serverless function execution',
    icon: Zap,
    color: 'var(--cf-green)',
    defaultConfig: {
      name: 'my-function',
      runtime: 'nodejs20.x',
      memory: 128,
      timeout: 30,
      handler: 'index.handler',
      environment: {},
    },
  },
  s3: {
    id: 's3',
    label: 'S3 Bucket',
    category: 'Storage',
    description: 'Object storage at any scale',
    icon: HardDrive,
    color: 'var(--cf-cyan)',
    defaultConfig: {
      bucketName: '',
      versioning: false,
      publicAccess: false,
      encryption: 'AES256',
      region: 'us-east-1',
    },
  },
  rds: {
    id: 'rds',
    label: 'RDS Database',
    category: 'Database',
    description: 'Managed relational database service',
    icon: Database,
    color: 'var(--cf-cyan)',
    defaultConfig: {
      identifier: 'my-db',
      engine: 'postgres',
      engineVersion: '15',
      instanceClass: 'db.t3.micro',
      multiAz: false,
      storageGb: 20,
    },
  },
  ec2: {
    id: 'ec2',
    label: 'EC2 Instance',
    category: 'Compute',
    description: 'Virtual servers in the cloud',
    icon: Server,
    color: 'var(--cf-green)',
    defaultConfig: {
      instanceType: 't3.micro',
      keyPair: '',
      publicIp: true,
      storageGb: 8,
    },
  },
  cloudfront: {
    id: 'cloudfront',
    label: 'CloudFront',
    category: 'CDN',
    description: 'Global content delivery network',
    icon: Network,
    color: 'var(--cf-text-primary)',
    defaultConfig: {
      priceClass: 'PriceClass_100',
      httpVersion: 'http2',
      ipv6: true,
    },
  },
  vpc: {
    id: 'vpc',
    label: 'VPC',
    category: 'Networking',
    description: 'Isolated virtual network',
    icon: Shield,
    color: 'var(--cf-text-primary)',
    defaultConfig: {
      cidr: '10.0.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      region: 'us-east-1',
    },
  },
  'iam-role': {
    id: 'iam-role',
    label: 'IAM Role',
    category: 'Security',
    description: 'Identity and access management',
    icon: Lock,
    color: 'var(--cf-amber)',
    defaultConfig: {
      roleName: '',
      trustedService: 'lambda.amazonaws.com',
      managedPolicies: [],
    },
  },
  elasticache: {
    id: 'elasticache',
    label: 'ElastiCache',
    category: 'Cache',
    description: 'In-memory caching service',
    icon: BarChart,
    color: 'var(--cf-amber)',
    defaultConfig: {
      engine: 'redis',
      nodeType: 'cache.t3.micro',
      numNodes: 1,
      port: 6379,
    },
  },
  sns: {
    id: 'sns',
    label: 'SNS Topic',
    category: 'Messaging',
    description: 'Pub/sub messaging and notifications',
    icon: Cloud,
    color: 'var(--cf-green)',
    defaultConfig: {
      topicName: '',
      fifo: false,
      contentDedup: false,
    },
  },
};

export const serviceList = Object.values(awsServices);

export const servicesByCategory: Record<string, AWSServiceDefinition[]> =
  serviceList.reduce(
    (acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, AWSServiceDefinition[]>
  );

/** Returns the dot color for a given service category. */
export function getCategoryColor(category: ServiceCategory): string {
  switch (category) {
    case 'Compute':
    case 'Messaging':
      return 'var(--cf-green)';
    case 'Storage':
    case 'Database':
      return 'var(--cf-cyan)';
    case 'Cache':
    case 'Security':
      return 'var(--cf-amber)';
    case 'Networking':
    case 'CDN':
    default:
      return 'var(--cf-text-muted)';
  }
}

/** Returns 2–3 most relevant config values as a subtitle string. */
export function getNodeSubtitle(
  serviceId: string,
  config: Record<string, unknown>
): string {
  switch (serviceId) {
    case 'lambda':
      return [
        config.runtime,
        typeof config.memory === 'number' ? `${config.memory}MB` : undefined,
        typeof config.timeout === 'number' ? `${config.timeout}s` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'rds':
      return [config.engine, config.instanceClass].filter(Boolean).join(' · ');
    case 's3':
      return [config.bucketName || 'unnamed', config.encryption, config.region]
        .filter(Boolean)
        .join(' · ');
    case 'ec2':
      return [config.instanceType, typeof config.storageGb === 'number' ? `${config.storageGb}GB` : undefined]
        .filter(Boolean)
        .join(' · ');
    case 'api-gateway':
      return [config.type, config.stage].filter(Boolean).join(' · ');
    case 'cloudfront':
      return [config.priceClass, config.httpVersion].filter(Boolean).join(' · ');
    case 'vpc':
      return [config.cidr, config.region].filter(Boolean).join(' · ');
    case 'iam-role':
      return [config.roleName || 'unnamed', config.trustedService]
        .filter(Boolean)
        .join(' · ');
    case 'elasticache':
      return [config.engine, config.nodeType].filter(Boolean).join(' · ');
    case 'sns':
      return [
        config.topicName || 'unnamed',
        config.fifo ? 'FIFO' : 'Standard',
      ]
        .filter(Boolean)
        .join(' · ');
    default:
      return '';
  }
}
