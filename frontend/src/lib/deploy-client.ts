/**
 * Deploy client — connects to the backend SSE stream and dispatches events.
 *
 * Usage:
 *   const client = new DeployClient();
 *   const deploymentId = await client.startDeployment(archData, projectName);
 *   client.streamEvents(deploymentId, {
 *     onLog: (msg) => addDeployLog(msg),
 *     onNodeStatus: (nodeId, status) => updateNodeDeployStatus(nodeId, status),
 *     onComplete: (outputs) => setStageStatus('deploy', 'done'),
 *     onError: (msg) => console.error(msg),
 *   });
 */

export interface DeployStreamCallbacks {
  onLog: (message: string) => void;
  onNodeStatus: (nodeId: string, status: 'provisioning' | 'live') => void;
  onStageChange?: (stage: string, message: string) => void;
  onTerraformOutput?: (line: string) => void;
  onComplete: (outputs: Record<string, unknown>) => void;
  onError: (message: string) => void;
}

interface DeployStartResponse {
  deploymentId: string;
  status: string;
  message?: string;
  mock?: boolean;
}

interface SSEEvent {
  type: 'log' | 'node_status' | 'stage_change' | 'terraform_output' | 'error' | 'complete';
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export class DeployClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl = '/api/deploy') {
    this.baseUrl = baseUrl;
  }

  /**
   * Start a deployment by posting architecture data to the backend.
   */
  async startDeployment(
    architectureData: { nodes: unknown[]; edges: unknown[] },
    projectName: string,
    region = 'us-east-1',
    environment = 'prod',
  ): Promise<DeployStartResponse> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        architectureData,
        projectName,
        region,
        environment,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Deploy start failed (${res.status}): ${text}`);
    }

    return res.json();
  }

  /**
   * Connect to the SSE event stream for a deployment and dispatch events.
   */
  async streamEvents(
    deploymentId: string,
    callbacks: DeployStreamCallbacks,
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const res = await fetch(`${this.baseUrl}?id=${deploymentId}`, {
        headers: { Accept: 'text/event-stream' },
        signal: this.abortController.signal,
      });

      if (!res.ok || !res.body) {
        callbacks.onError(`Failed to connect to deploy stream (${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event: SSEEvent = JSON.parse(jsonStr);
            this.dispatchEvent(event, callbacks);
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Intentional abort
      }
      callbacks.onError(`Stream error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  /**
   * Stop the active SSE stream.
   */
  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private dispatchEvent(event: SSEEvent, callbacks: DeployStreamCallbacks): void {
    switch (event.type) {
      case 'log':
        callbacks.onLog(event.message);
        break;

      case 'node_status': {
        const nodeId = event.data.nodeId as string;
        const status = event.data.status as 'provisioning' | 'live';
        if (nodeId && status) {
          callbacks.onNodeStatus(nodeId, status);
        }
        callbacks.onLog(event.message);
        break;
      }

      case 'stage_change':
        callbacks.onStageChange?.(event.data.stage as string, event.message);
        callbacks.onLog(`── ${event.message} ──`);
        break;

      case 'terraform_output':
        callbacks.onTerraformOutput?.(event.message);
        callbacks.onLog(event.message);
        break;

      case 'error':
        callbacks.onError(event.message);
        callbacks.onLog(`ERROR: ${event.message}`);
        break;

      case 'complete':
        callbacks.onComplete((event.data.outputs as Record<string, unknown>) || {});
        callbacks.onLog(event.message);
        break;
    }
  }
}
