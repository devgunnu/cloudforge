import type { Node, Edge } from '@xyflow/react';
import type { CloudForgeTopology } from '@/types/topology';

export interface NodeData {
  serviceId: string;
  label: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

export function exportTopology(
  nodes: Node[],
  edges: Edge[],
  projectName = 'my-cloudforge-project',
  region = 'us-east-1'
): CloudForgeTopology {
  const serviceTypes = Array.from(
    new Set(nodes.map((n) => (n.data as NodeData).serviceId))
  );

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    projectName,
    region,
    resources: nodes.map((node) => {
      const data = node.data as NodeData;
      return {
        id: node.id,
        serviceId: data.serviceId,
        label: data.label,
        position: node.position,
        config: data.config,
      };
    }),
    connections: edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      label: edge.label as string | undefined,
    })),
    metadata: {
      nodeCount: nodes.length,
      connectionCount: edges.length,
      serviceTypes,
      estimatedMonthlyCost: estimateCost(nodes),
    },
  };
}

function estimateCost(nodes: Node[]): string {
  // Placeholder cost estimation — replace with real pricing logic.
  const costMap: Record<string, number> = {
    lambda: 0.5,
    'api-gateway': 3.5,
    s3: 1.5,
    rds: 15,
    ec2: 8,
    cloudfront: 2,
    vpc: 0,
    'iam-role': 0,
    elasticache: 12,
    sns: 0.5,
  };

  const total = nodes.reduce((sum, node) => {
    const serviceId = (node.data as NodeData).serviceId;
    return sum + (costMap[serviceId] ?? 1);
  }, 0);

  return `~$${total.toFixed(0)}/mo`;
}
