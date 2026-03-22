export type DeployStatus = 'idle' | 'generating' | 'deploying' | 'live' | 'error';

export interface DeployEvent {
  status: DeployStatus;
  logLine?: string;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Async generator that yields DeployEvents simulating a real deploy.
 * Consume with: for await (const event of runMockDeploy()) { ... }
 */
export async function* runMockDeploy(): AsyncGenerator<DeployEvent> {
  // Phase 1: generating (1200ms)
  yield { status: 'generating', logLine: '→ Parsing architecture graph...' };
  await delay(600);
  yield { status: 'generating', logLine: '→ Generating Terraform modules...' };
  await delay(600);

  // Phase 2: deploying (2800ms)
  yield { status: 'deploying', logLine: '→ Provisioning Lambda functions...' };
  await delay(700);
  yield { status: 'deploying', logLine: '→ Configuring IAM roles...' };
  await delay(700);
  yield { status: 'deploying', logLine: '→ Setting up VPC networking...' };
  await delay(700);

  // ============================================================
  // BACKEND HOOK: POST /api/deploy
  // Payload: CloudForgeTopology JSON
  // The Claude agent receives this and runs Terraform via
  // the AWS Cloud Control API MCP server.
  // Replace this mock generator with real API integration.
  // ============================================================
  yield { status: 'deploying', logLine: '→ Submitting to provisioning agent...' };
  await delay(700);

  // Phase 3: live
  yield { status: 'live', logLine: '✓ Infrastructure live' };
}
