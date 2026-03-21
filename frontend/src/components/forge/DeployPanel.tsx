'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForgeStore } from '@/store/forgeStore';
import { runDeploy, MOCK_ARCH_NODES, MOCK_ARCH_EDGES } from '@/lib/forge-agents';
import type { ForgeArchNode, ForgeArchEdge } from '@/store/forgeStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodePosition {
  x: number;
  y: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function logTimestamp(index: number): string {
  const base = 14 * 60 * 32 + 60; // 14:32:01 in seconds from midnight
  const seconds = base + index * 11;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getLogColor(line: string): string {
  if (line.startsWith('✓')) return '#34d399';
  if (line.startsWith('⟳')) return '#f59e0b';
  return 'var(--lp-text-secondary)';
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: ForgeArchNode;
}

function NodeCard({ node }: NodeCardProps) {
  const status = node.deployStatus;

  const borderStyle = useMemo((): React.CSSProperties => {
    if (status === 'live') return { border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.05)' };
    if (status === 'provisioning') return { border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.05)' };
    return { border: '0.5px dashed rgba(255,255,255,0.10)', background: 'transparent' };
  }, [status]);

  const boxShadow = useMemo((): string => {
    if (status === 'live') return '0 0 10px rgba(52,211,153,0.15)';
    if (status === 'provisioning') return '0 0 8px rgba(245,158,11,0.15)';
    return 'none';
  }, [status]);

  const labelColor = status === 'queued' ? 'var(--lp-text-hint)' : 'var(--lp-text-primary)';

  return (
    <motion.div
      layout
      animate={{
        boxShadow,
        scale: status === 'live' ? [1, 1.02, 1] : 1,
      }}
      transition={
        status === 'live'
          ? { duration: 0.4, ease: 'easeOut' }
          : { duration: 0.3 }
      }
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: '140px',
        borderRadius: '8px',
        padding: '8px 10px',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        cursor: 'default',
        ...borderStyle,
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: labelColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {node.label}
      </div>

      <div
        style={{
          fontSize: '10px',
          color: 'var(--lp-text-hint)',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {node.sublabel}
      </div>

      {/* Status sublabel */}
      <div style={{ marginTop: '5px' }}>
        {status === 'queued' && (
          <span
            style={{
              fontSize: '9px',
              color: 'var(--lp-text-hint)',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Queued
          </span>
        )}
        {status === 'provisioning' && (
          <motion.span
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              fontSize: '9px',
              color: '#f59e0b',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            ⟳ Provisioning
          </motion.span>
        )}
        {status === 'live' && (
          <span
            style={{
              fontSize: '9px',
              color: '#34d399',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            ✓ Live
          </span>
        )}
      </div>
    </motion.div>
  );
}

interface ArchDiagramProps {
  nodes: ForgeArchNode[];
  edges: ForgeArchEdge[];
}

function ArchDiagram({ nodes, edges }: ArchDiagramProps) {
  const nodeMap = useMemo<Map<string, NodePosition>>(
    () => new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])),
    [nodes]
  );

  // Bounding box for SVG overlay
  const svgWidth = 660;
  const svgHeight = 520;

  const liveCount = nodes.filter((n) => n.deployStatus === 'live').length;
  const provCount = nodes.filter((n) => n.deployStatus === 'provisioning').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '0.6',
        minHeight: 0,
        overflow: 'hidden',
        borderBottom: '0.5px solid var(--lp-border)',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          flexShrink: 0,
          borderBottom: '0.5px solid var(--lp-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-text-hint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Infrastructure
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AnimatePresence>
            {provCount > 0 && (
              <motion.span
                key="prov-badge"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: '#f59e0b',
                  background: 'rgba(245,158,11,0.08)',
                  border: '0.5px solid rgba(245,158,11,0.3)',
                  borderRadius: '100px',
                  padding: '2px 8px',
                }}
              >
                {provCount} provisioning
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {liveCount > 0 && (
              <motion.span
                key="live-badge"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: '#34d399',
                  background: 'rgba(52,211,153,0.08)',
                  border: '0.5px solid rgba(52,211,153,0.3)',
                  borderRadius: '100px',
                  padding: '2px 8px',
                }}
              >
                {liveCount} live
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Diagram canvas */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          background: 'var(--lp-bg)',
        }}
      >
        {/* SVG edges */}
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="deploy-arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L6,3 z"
                fill="rgba(45,212,191,0.35)"
              />
            </marker>
          </defs>

          {edges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;

            const x1 = from.x + 70;
            const y1 = from.y + 40;
            const x2 = to.x + 70;
            const y2 = to.y;

            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(45,212,191,0.3)"
                strokeWidth="1"
                strokeDasharray="4 3"
                markerEnd="url(#deploy-arrowhead)"
              />
            );
          })}
        </svg>

        {/* Node cards */}
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}

interface LogLineProps {
  line: string;
  index: number;
}

function LogLine({ line, index }: LogLineProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'flex',
        gap: '10px',
        lineHeight: 1.7,
        wordBreak: 'break-all',
      }}
    >
      <span
        style={{
          color: 'var(--lp-text-hint)',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {logTimestamp(index)}
      </span>
      <span style={{ color: getLogColor(line) }}>{line}</span>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DeployPanel() {
  const {
    stageStatus,
    architectureData,
    generatedFiles,
    deployLog,
    addDeployLog,
    updateNodeDeployStatus,
    setStageStatus,
    addChatMessage,
  } = useForgeStore();

  const agentRan = useRef(false);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const [confirmPulsed, setConfirmPulsed] = useState(false);

  const deployStatus = stageStatus.deploy;
  const isDone = deployStatus === 'done';

  // Resolve nodes and edges — fall back to mocks if architectureData not yet populated
  const nodes: ForgeArchNode[] = architectureData?.nodes ?? MOCK_ARCH_NODES;
  const edges: ForgeArchEdge[] = architectureData?.edges ?? MOCK_ARCH_EDGES;

  // Run deploy agent on mount if status is 'processing'
  useEffect(() => {
    if (agentRan.current) return;
    if (deployStatus !== 'processing') return;

    agentRan.current = true;

    addChatMessage('deploy', {
      id: `deploy-start-${Date.now()}`,
      role: 'agent',
      content:
        'Initiating AWS provisioning sequence. Monitoring resource creation in real-time\u2026',
    });

    const files = Object.values(generatedFiles);
    const archData = architectureData ?? {
      nodes: MOCK_ARCH_NODES,
      edges: MOCK_ARCH_EDGES,
    };

    runDeploy(files, archData, {
      onLog: (line: string) => addDeployLog(line),
      onNodeStatus: (nodeId: string, status: 'provisioning' | 'live') =>
        updateNodeDeployStatus(nodeId, status),
    }).then(() => {
      setStageStatus('deploy', 'done');
      addChatMessage('deploy', {
        id: `deploy-done-${Date.now()}`,
        role: 'agent',
        content:
          'Deployment complete. All 5 resources are live. est. $32.70/month.',
      });
    });
  }, [
    deployStatus,
    generatedFiles,
    architectureData,
    addDeployLog,
    updateNodeDeployStatus,
    setStageStatus,
    addChatMessage,
  ]);

  // Auto-scroll logs to bottom when new lines arrive
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [deployLog]);

  // Pulse "Confirm & Finalize" once when deploy completes
  const prevDoneRef = useRef(isDone);
  useEffect(() => {
    if (!prevDoneRef.current && isDone) {
      setConfirmPulsed(true);
      const t = setTimeout(() => setConfirmPulsed(false), 600);
      prevDoneRef.current = true;
      return () => clearTimeout(t);
    }
    prevDoneRef.current = isDone;
  }, [isDone]);

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--lp-surface)',
        overflow: 'hidden',
        minWidth: 0,
      }}
      aria-label="Deploy panel"
    >
      {/* Section 1 — Architecture diagram */}
      <ArchDiagram nodes={nodes} edges={edges} />

      {/* Section 2 — Live logs */}
      <div
        style={{
          flex: '0.4',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Logs header */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '0.5px solid var(--lp-border)',
            borderBottom: '0.5px solid var(--lp-border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '11px',
              color: 'var(--lp-text-hint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Deploy logs
          </span>
        </div>

        {/* Log scroll area */}
        <div
          ref={logScrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
          }}
          aria-live="polite"
          aria-label="Deployment log output"
        >
          <AnimatePresence initial={false}>
            {deployLog.map((line, i) => (
              <LogLine key={`${i}-${line.slice(0, 12)}`} line={line} index={i} />
            ))}
          </AnimatePresence>

          {deployLog.length === 0 && deployStatus === 'processing' && (
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-text-hint)',
              }}
            >
              Waiting for deploy agent\u2026
            </span>
          )}
        </div>
      </div>

      {/* Section 3 — Cost + action strip */}
      <div
        style={{
          height: '52px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '16px',
          background: 'var(--lp-surface)',
          borderTop: '0.5px solid var(--lp-border)',
        }}
      >
        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
          {(
            [
              { label: 'Est. cost', value: '~$32.70/mo' },
              { label: 'Services', value: '5 AWS resources' },
              { label: 'IAM roles', value: '2' },
            ] as const
          ).map((stat) => (
            <div key={stat.label}>
              <div
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '10px',
                  color: 'var(--lp-text-hint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--lp-text-primary)',
                  marginTop: '1px',
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Rollback ghost button */}
          <button
            type="button"
            style={{
              background: 'transparent',
              border: '0.5px solid var(--lp-border-hover)',
              borderRadius: '7px',
              padding: '6px 14px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--lp-text-secondary)',
              cursor: 'pointer',
            }}
            aria-label="Rollback deployment"
          >
            Rollback
          </button>

          {/* Confirm & Finalize primary button */}
          <motion.button
            type="button"
            disabled={!isDone}
            animate={confirmPulsed ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              background: isDone ? 'var(--lp-accent-dim)' : 'transparent',
              border: `0.5px solid ${isDone ? 'rgba(45,212,191,0.3)' : 'var(--lp-border-hover)'}`,
              borderRadius: '7px',
              padding: '6px 16px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              color: isDone ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
              cursor: isDone ? 'pointer' : 'not-allowed',
              opacity: isDone ? 1 : 0.45,
              transition:
                'background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease',
            }}
            aria-disabled={!isDone}
            aria-label="Confirm and finalize deployment"
          >
            Confirm &amp; Finalize
          </motion.button>
        </div>
      </div>
    </div>
  );
}
