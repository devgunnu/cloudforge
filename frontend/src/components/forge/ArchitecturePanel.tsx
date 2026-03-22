'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForgeStore } from '@/store/forgeStore';
import ArchDiagram, { convertForgeNodes, convertForgeEdges } from '@/components/cloudforge/ArchDiagram';
import {
  runAgent2,
  AGENT2_STEPS,
} from '@/lib/forge-agents';
import type { ForgeArchNode } from '@/store/forgeStore';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const {
    constraints,
    architectureData,
    setArchitectureData,
    stageStatus,
    setStageStatus,
    addChatMessage,
    advanceStage,
    currentProjectId,
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
    }, currentProjectId ?? undefined).then((data) => {
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
      ? (architectureData?.nodes ?? []).find(
          (n) => n.id === selectedNodeId,
        ) ?? null
      : null;

  const handleNodeClick = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  function handleContinueToBuild() {
    advanceStage();
    router.push(`/app/${id}/build`);
  }

  const displayNodes = architectureData?.nodes ?? [];
  const displayEdges = architectureData?.edges ?? [];

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
            flex: 1,
            minHeight: 300,
            overflow: 'hidden',
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
                <ArchDiagram
                  nodes={convertForgeNodes(displayNodes)}
                  edges={convertForgeEdges(displayEdges)}
                  onNodeSelect={handleNodeClick}
                  selectedNodeId={selectedNodeId}
                />
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
