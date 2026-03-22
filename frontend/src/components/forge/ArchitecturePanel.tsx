'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForgeStore } from '@/store/forgeStore';
import {
  runAgent2,
  AGENT2_STEPS,
  MOCK_ARCH_NODES,
  MOCK_ARCH_EDGES,
} from '@/lib/forge-agents';
import type { ForgeArchNode } from '@/store/forgeStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_W = 140;
const NODE_H = 70;

const ALTERNATIVES = [
  {
    name: 'DynamoDB',
    reason:
      'High read latency at P95 for complex user queries — rejected in favor of RDS Postgres',
  },
  {
    name: 'ECS Fargate',
    reason:
      'Cold start overhead from container spin-up exceeds the 200ms P95 NFR — Lambda arm64 chosen',
  },
];

// ── Node type color maps ───────────────────────────────────────────────────────

const NODE_COLORS: Record<
  ForgeArchNode['type'],
  { background: string; border: string; borderSelected: string }
> = {
  gateway: {
    background: 'rgba(45,212,191,0.06)',
    border: 'rgba(45,212,191,0.25)',
    borderSelected: 'rgba(45,212,191,0.7)',
  },
  compute: {
    background: 'rgba(45,212,191,0.06)',
    border: 'rgba(45,212,191,0.2)',
    borderSelected: 'rgba(45,212,191,0.6)',
  },
  cache: {
    background: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.2)',
    borderSelected: 'rgba(245,158,11,0.65)',
  },
  storage: {
    background: 'rgba(52,211,153,0.06)',
    border: 'rgba(52,211,153,0.2)',
    borderSelected: 'rgba(52,211,153,0.65)',
  },
  auth: {
    background: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.2)',
    borderSelected: 'rgba(167,139,250,0.65)',
  },
  queue: {
    background: 'rgba(45,212,191,0.06)',
    border: 'rgba(45,212,191,0.15)',
    borderSelected: 'rgba(45,212,191,0.55)',
  },
};

const VALIDATES_CHIP_COLORS: Record<ForgeArchNode['type'], string> = {
  gateway: 'rgba(45,212,191,0.15)',
  compute: 'rgba(45,212,191,0.15)',
  cache: 'rgba(245,158,11,0.15)',
  storage: 'rgba(52,211,153,0.15)',
  auth: 'rgba(167,139,250,0.15)',
  queue: 'rgba(45,212,191,0.12)',
};

// ── Processing overlay step list ──────────────────────────────────────────────

function StepDot({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <span
        aria-hidden="true"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--lp-accent)',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  if (state === 'active') {
    return (
      <motion.span
        aria-hidden="true"
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'rgba(245,158,11,0.9)',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: 'var(--lp-text-hint)',
        flexShrink: 0,
        display: 'block',
      }}
    />
  );
}

// ── Architecture diagram: SVG edge overlay ────────────────────────────────────

interface EdgeOverlayProps {
  nodes: ForgeArchNode[];
  edges: Array<{ from: string; to: string }>;
}

function EdgeOverlay({ nodes, edges }: EdgeOverlayProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      {edges.map((edge, i) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return null;

        const x1 = fromNode.x + NODE_W / 2;
        const y1 = fromNode.y + NODE_H / 2;
        const x2 = toNode.x + NODE_W / 2;
        const y2 = toNode.y + NODE_H / 2;

        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--lp-accent)"
            strokeOpacity={0.4}
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

// ── Architecture diagram: single node card ────────────────────────────────────

interface NodeCardProps {
  node: ForgeArchNode;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function NodeCard({ node, isSelected, onClick }: NodeCardProps) {
  const colors = NODE_COLORS[node.type];

  return (
    <motion.button
      type="button"
      onClick={() => onClick(node.id)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-pressed={isSelected}
      aria-label={`${node.label} — ${node.sublabel}`}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: `${NODE_W}px`,
        height: `${NODE_H}px`,
        background: colors.background,
        border: `${isSelected ? '1.5px' : '0.5px'} solid ${
          isSelected ? colors.borderSelected : colors.border
        }`,
        borderRadius: '10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '10px 12px',
        textAlign: 'left',
        gap: '3px',
        outline: 'none',
        transition: 'border-color 150ms ease',
      }}
    >
      {/* Validated badge */}
      <span
        aria-label="validated"
        style={{
          position: 'absolute',
          top: '6px',
          right: '8px',
          fontSize: '9px',
          color: 'rgba(52,211,153,0.9)',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        ✓
      </span>

      {/* Service name */}
      <span
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--lp-text-primary)',
          lineHeight: 1.2,
          paddingRight: '14px',
        }}
      >
        {node.label}
      </span>

      {/* Sublabel */}
      <span
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '10px',
          color: 'var(--lp-text-secondary)',
          lineHeight: 1.2,
        }}
      >
        {node.sublabel}
      </span>
    </motion.button>
  );
}

// ── Node inspector panel ──────────────────────────────────────────────────────

interface InspectorSection {
  label: string;
  children: React.ReactNode;
}

function InspectorSectionBlock({ label, children }: InspectorSection) {
  return (
    <div
      style={{
        paddingBottom: '14px',
        borderBottom: '0.5px solid var(--lp-border)',
        marginBottom: '14px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--lp-text-hint)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: '0 0 8px 0',
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

interface NodeInspectorProps {
  node: ForgeArchNode | null;
  onClose: () => void;
}

function NodeInspector({ node, onClose }: NodeInspectorProps) {
  return (
    <motion.aside
      animate={{ width: node ? 280 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      style={{
        overflow: 'hidden',
        height: '100%',
        flexShrink: 0,
        borderLeft: '0.5px solid var(--lp-border)',
        background: 'var(--lp-surface)',
        position: 'relative',
      }}
      aria-label="Node inspector"
    >
      {node && (
        <div
          style={{
            width: '280px',
            height: '100%',
            overflow: 'auto',
            padding: '20px',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '18px',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--lp-text-primary)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {node.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--lp-text-secondary)',
                fontSize: '16px',
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: '4px',
                flexShrink: 0,
                marginLeft: '8px',
              }}
            >
              ×
            </button>
          </div>

          {/* Terraform resource */}
          <InspectorSectionBlock label="Terraform resource">
            <code
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-accent)',
                background: 'var(--lp-elevated)',
                border: '0.5px solid var(--lp-border)',
                borderRadius: '5px',
                padding: '4px 8px',
                display: 'block',
                wordBreak: 'break-all',
              }}
            >
              {node.terraformResource}
            </code>
          </InspectorSectionBlock>

          {/* Estimated cost */}
          <InspectorSectionBlock label="Est. cost">
            <span
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                color: 'var(--lp-text-primary)',
              }}
            >
              {node.estimatedCost}
            </span>
          </InspectorSectionBlock>

          {/* Config */}
          <InspectorSectionBlock label="Config">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {Object.entries(node.config).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: '11px',
                  }}
                >
                  <span style={{ color: 'var(--lp-text-secondary)', flexShrink: 0 }}>
                    {key}:
                  </span>
                  <span
                    style={{
                      color: 'var(--lp-text-primary)',
                      background: 'var(--lp-elevated)',
                      border: '0.5px solid var(--lp-border)',
                      borderRadius: '5px',
                      padding: '2px 6px',
                      minWidth: 0,
                      wordBreak: 'break-all',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </InspectorSectionBlock>

          {/* Why chosen */}
          <InspectorSectionBlock label="Why chosen">
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                color: 'var(--lp-text-secondary)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {node.whyChosen}
            </p>
          </InspectorSectionBlock>

          {/* Validates */}
          <div>
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--lp-text-hint)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                margin: '0 0 8px 0',
              }}
            >
              Validates
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {node.validates.map((constraint) => (
                <span
                  key={constraint}
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'rgba(52,211,153,0.9)',
                    background: VALIDATES_CHIP_COLORS[node.type],
                    border: '0.5px solid rgba(52,211,153,0.2)',
                    borderRadius: '100px',
                    padding: '2px 8px',
                  }}
                >
                  {constraint}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArchitecturePanel() {
  const router = useRouter();
  const {
    constraints,
    architectureData,
    setArchitectureData,
    stageStatus,
    setStageStatus,
    addChatMessage,
    advanceStage,
  } = useForgeStore();

  const [activeStep, setActiveStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const agentRan = useRef(false);

  // Run Agent 2 on mount if stage is 'processing' or 'locked' (dev direct-nav)
  useEffect(() => {
    if (agentRan.current) return;
    if (stageStatus.architecture !== 'processing' && stageStatus.architecture !== 'locked') return;

    agentRan.current = true;

    addChatMessage('architecture', {
      id: `agent2-start-${Date.now()}`,
      role: 'agent',
      content:
        'Traversing the knowledge graph to find the optimal architecture for your constraints…',
    });

    setProcessing(true);
    setActiveStep(0);

    runAgent2(constraints, (step) => {
      setActiveStep(step);
    }).then((data) => {
      setArchitectureData(data);
      setStageStatus('architecture', 'done');
      setProcessing(false);
      addChatMessage('architecture', {
        id: `agent2-done-${Date.now()}`,
        role: 'agent',
        content:
          'Architecture validated. 2 alternatives considered and rejected. Proceed to Build when ready.',
      });
    }).catch(() => {
      setProcessing(false);
      addChatMessage('architecture', {
        id: `agent2-error-${Date.now()}`,
        role: 'agent',
        content: 'Architecture generation failed. Please try again.',
      });
      agentRan.current = false;
    });
  }, [stageStatus.architecture, constraints, addChatMessage, setArchitectureData, setStageStatus]);

  const isDone = stageStatus.architecture === 'done';

  const selectedNode =
    selectedNodeId != null
      ? (architectureData?.nodes ?? MOCK_ARCH_NODES).find(
          (n) => n.id === selectedNodeId,
        ) ?? null
      : null;

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id));
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  function handleContinueToBuild() {
    advanceStage();
    router.push('/app/build');
  }

  const displayNodes = architectureData?.nodes ?? MOCK_ARCH_NODES;
  const displayEdges = architectureData?.edges ?? MOCK_ARCH_EDGES;

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: 'var(--lp-bg)',
        position: 'relative',
      }}
      aria-label="Architecture panel"
    >
      {/* ── Main canvas area ──────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 36px 28px 36px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* ── Header row ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--lp-text-secondary)',
            }}
          >
            Architecture
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AnimatePresence mode="wait">
              {processing && (
                <motion.span
                  key="processing-badge"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'rgba(245,158,11,0.9)',
                    background: 'rgba(245,158,11,0.08)',
                    border: '0.5px solid rgba(245,158,11,0.25)',
                    borderRadius: '100px',
                    padding: '3px 10px',
                  }}
                >
                  Processing…
                </motion.span>
              )}

              {isDone && (
                <motion.div
                  key="done-badges"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', gap: '6px' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--lp-text-secondary)',
                      background: 'var(--lp-elevated)',
                      border: '0.5px solid var(--lp-border-hover)',
                      borderRadius: '100px',
                      padding: '3px 10px',
                    }}
                  >
                    2 alternatives
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'rgba(52,211,153,0.9)',
                      background: 'rgba(52,211,153,0.08)',
                      border: '0.5px solid rgba(52,211,153,0.2)',
                      borderRadius: '100px',
                      padding: '3px 10px',
                    }}
                  >
                    Validated ✓
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Diagram container ───────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            height: '480px',
            flexShrink: 0,
            overflow: 'visible',
          }}
          aria-label="Architecture diagram"
        >
          {/* Processing overlay — absolute, covers only the canvas */}
          <AnimatePresence>
            {processing && (
              <motion.div
                key="processing-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  background: 'rgba(13,15,19,0.92)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                }}
                aria-live="polite"
                aria-label="Agent 2 is processing"
              >
                {/* Spinner */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '2px solid rgba(45,212,191,0.15)',
                    borderTopColor: 'var(--lp-accent)',
                    marginBottom: '16px',
                  }}
                  aria-hidden="true"
                />

                <p
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--lp-text-primary)',
                    margin: '0 0 4px 0',
                  }}
                >
                  Agent 2 is reasoning…
                </p>

                <p
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '12px',
                    color: 'var(--lp-text-secondary)',
                    margin: '0 0 24px 0',
                  }}
                >
                  Traversing knowledge graph
                </p>

                {/* Step list */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}
                >
                  {AGENT2_STEPS.map((stepLabel, i) => {
                    const state =
                      i < activeStep
                        ? 'done'
                        : i === activeStep
                          ? 'active'
                          : 'pending';
                    return (
                      <div
                        key={stepLabel}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <StepDot state={state} />
                        <span
                          style={{
                            fontFamily: 'var(--font-inter), system-ui, sans-serif',
                            fontSize: '12px',
                            color:
                              state === 'pending'
                                ? 'var(--lp-text-hint)'
                                : state === 'active'
                                  ? 'var(--lp-text-primary)'
                                  : 'var(--lp-text-secondary)',
                          }}
                        >
                          {stepLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Architecture diagram — revealed after processing */}
          <AnimatePresence>
            {!processing && (
              <motion.div
                key="arch-diagram"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                }}
              >
                {/* SVG edge overlay */}
                <EdgeOverlay nodes={displayNodes} edges={displayEdges} />

                {/* Node cards */}
                {displayNodes.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    isSelected={selectedNodeId === node.id}
                    onClick={handleNodeClick}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Alternatives rejected panel ─────────────────────────────────────── */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              key="alternatives-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
              style={{
                marginTop: '28px',
                flexShrink: 0,
              }}
              aria-label="Alternatives considered"
            >
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--lp-text-hint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 10px 0',
                }}
              >
                Alternatives Considered
              </p>

              {ALTERNATIVES.map((alt, i) => (
                <div
                  key={alt.name}
                  style={{
                    display: 'inline-flex',
                    gap: '8px',
                    padding: '8px 0',
                    borderBottom:
                      i < ALTERNATIVES.length - 1
                        ? '0.5px solid var(--lp-border)'
                        : 'none',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '11px',
                      color: 'var(--lp-text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {alt.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      color: 'var(--lp-text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {alt.reason}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA: Continue to Build ──────────────────────────────────────────── */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              key="cta-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              style={{
                marginTop: 'auto',
                paddingTop: '20px',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <motion.button
                type="button"
                onClick={handleContinueToBuild}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  padding: '8px 20px',
                  background: 'var(--lp-accent-dim)',
                  border: '0.5px solid rgba(45,212,191,0.3)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--lp-accent)',
                  cursor: 'pointer',
                }}
                aria-label="Continue to Build stage"
              >
                Continue to Build →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Node inspector panel (collapsible right edge) ─────────────────────── */}
      <NodeInspector node={selectedNode} onClose={handleCloseInspector} />
    </div>
  );
}
