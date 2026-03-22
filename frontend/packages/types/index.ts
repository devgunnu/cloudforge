// ============================================================
// Shared CloudForge topology schema.
// This is the contract between the frontend canvas and the
// Claude backend agent that generates + executes Terraform.
// Do not change field names without updating the backend
// Terraform generator.
// ============================================================

export interface CloudForgeTopology {
  version: '1.0';
  generatedAt: string; // ISO 8601
  projectName: string;
  region: string; // default 'us-east-1'
  resources: CloudForgeResource[];
  connections: CloudForgeConnection[];
  metadata: {
    nodeCount: number;
    connectionCount: number;
    serviceTypes: string[]; // unique service ids present
    estimatedMonthlyCost: string; // placeholder: "~$12/mo"
  };
}

export interface CloudForgeResource {
  id: string; // React Flow node id
  serviceId: string; // e.g. 'lambda'
  label: string; // user-set display name
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface CloudForgeConnection {
  id: string; // React Flow edge id
  sourceId: string;
  targetId: string;
  label?: string;
}
