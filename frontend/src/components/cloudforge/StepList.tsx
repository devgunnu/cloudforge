'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface SubAgent {
  name: string;
  output: string;
  status: 'done' | 'active' | 'pending';
}

interface BuildStep {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending';
  subAgents?: SubAgent[];
}

interface StepListProps {
  steps: BuildStep[];
}

export default function StepList({ steps }: StepListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    () => steps.find((s) => s.status === 'active')?.id ?? null,
  );

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const progressPct = `${Math.round((doneCount / steps.length) * 100)}%`;
  const progressLabel = `${doneCount} of ${steps.length} steps complete`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Step rows */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
        role="list"
        aria-label="Build steps"
      >
        {steps.map((step) => {
          const isExpanded = expandedId === step.id;
          const isActive = step.status === 'active';

          return (
            <div
              key={step.id}
              role="listitem"
              style={{
                borderRadius: '8px',
                background: isActive ? 'var(--cf-purple-glow)' : 'transparent',
                overflow: 'hidden',
              }}
            >
              {/* Main row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : step.id)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  borderRadius: '8px',
                  textAlign: 'left',
                }}
                aria-expanded={step.subAgents ? isExpanded : undefined}
                aria-label={`${step.label} — ${step.status}`}
              >
                {/* Status indicator */}
                <span
                  style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  aria-hidden
                >
                  {step.status === 'done' && (
                    <CheckCircle2 size={14} style={{ color: 'var(--lp-accent)' }} />
                  )}
                  {step.status === 'active' && (
                    <span
                      className="animate-pulse"
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--cf-purple)',
                        boxShadow: '0 0 8px var(--cf-purple-dim)',
                        display: 'block',
                      }}
                    />
                  )}
                  {step.status === 'pending' && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--lp-text-hint)',
                        opacity: 0.4,
                        display: 'block',
                      }}
                    />
                  )}
                </span>

                {/* Label */}
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    ...(step.status === 'done'
                      ? {
                          color: 'var(--lp-text-hint)',
                          textDecoration: 'line-through',
                          textDecorationColor: 'var(--lp-text-hint)',
                          opacity: 0.7,
                        }
                      : step.status === 'active'
                        ? { color: 'var(--lp-text-primary)', fontWeight: 600 }
                        : { color: 'var(--lp-text-hint)' }),
                  }}
                >
                  {step.label}
                </span>
              </button>

              {/* Sub-agents expansion */}
              {step.subAgents && (
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          paddingLeft: '28px',
                          paddingBottom: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        role="list"
                        aria-label="Sub-agents"
                      >
                        {step.subAgents.map((agent) => (
                          <SubAgentRow key={agent.name} agent={agent} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer progress bar */}
      <div
        style={{
          padding: '12px 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
          borderTop: '0.5px solid var(--lp-border)',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--lp-text-hint)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
        >
          {progressLabel}
        </span>
        <div
          style={{
            width: '100%',
            height: '3px',
            background: 'var(--lp-elevated)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-label={progressLabel}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: progressPct }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%',
              background: 'var(--lp-accent)',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SubAgentRow({ agent }: { agent: SubAgent }) {
  return (
    <div
      role="listitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '28px',
        fontSize: '12px',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
      }}
    >
      {/* Sub-agent indicator */}
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }} aria-hidden>
        {agent.status === 'done' && (
          <CheckCircle2 size={11} style={{ color: 'var(--lp-accent)' }} />
        )}
        {agent.status === 'active' && (
          <span
            className="animate-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--cf-purple)',
              display: 'block',
            }}
          />
        )}
        {agent.status === 'pending' && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--lp-text-hint)',
              opacity: 0.4,
              display: 'block',
            }}
          />
        )}
      </span>

      {/* Name */}
      <span style={{ color: 'var(--lp-text-secondary)' }}>{agent.name}</span>

      {/* Arrow */}
      <span style={{ color: 'var(--lp-text-hint)' }} aria-hidden>
        →
      </span>

      {/* Output */}
      <span
        style={{
          color:
            agent.status === 'done'
              ? 'var(--lp-accent)'
              : agent.status === 'active'
                ? 'var(--cf-purple)'
                : 'var(--lp-text-hint)',
        }}
      >
        {agent.output}
        {agent.status === 'active' && (
          <span className="animate-pulse" aria-label="writing in progress">
            ···
          </span>
        )}
      </span>
    </div>
  );
}
