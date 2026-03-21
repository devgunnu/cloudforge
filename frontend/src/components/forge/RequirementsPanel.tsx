'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForgeStore } from '@/store/forgeStore';
import { runAgent1 } from '@/lib/forge-agents';
import type { ConstraintChip } from '@/store/forgeStore';

// ── Pulsing dot for processing state ─────────────────────────────────────────

function PulsingDot() {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--lp-accent)',
        marginRight: '6px',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}

// ── Requirements panel ────────────────────────────────────────────────────────

export default function RequirementsPanel() {
  const router = useRouter();
  const {
    prdText,
    setPrdText,
    constraints,
    setConstraints,
    stageStatus,
    setStageStatus,
    addChatMessage,
    advanceStage,
  } = useForgeStore();

  const agentRan = useRef(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [genButtonPulsed, setGenButtonPulsed] = useState(false);

  const reqStatus = stageStatus.requirements;
  const isDone = reqStatus === 'done';
  const isProcessing = reqStatus === 'processing';

  // Trigger a single pulse animation when status transitions to done
  const prevDoneRef = useRef(isDone);
  useEffect(() => {
    if (!prevDoneRef.current && isDone) {
      setGenButtonPulsed(true);
      const t = setTimeout(() => setGenButtonPulsed(false), 600);
      prevDoneRef.current = true;
      return () => clearTimeout(t);
    }
    prevDoneRef.current = isDone;
  }, [isDone]);

  // Run agent 1 on mount if still processing (Strict Mode safe via ref guard)
  useEffect(() => {
    if (agentRan.current) return;
    if (reqStatus !== 'processing') return;

    agentRan.current = true;

    addChatMessage('requirements', {
      id: `agent1-start-${Date.now()}`,
      role: 'agent',
      content:
        "I'm analyzing your PRD to extract non-functional requirements and constraints…",
    });

    const collectedChips: ConstraintChip[] = [];

    runAgent1(prdText, (chip: ConstraintChip) => {
      collectedChips.push(chip);
      addChatMessage('requirements', {
        id: `agent1-chip-${chip.id}-${Date.now()}`,
        role: 'agent',
        content: '',
        chips: [chip],
      });
    }).then((chips) => {
      setConstraints(chips);
      setStageStatus('requirements', 'done');
      addChatMessage('requirements', {
        id: `agent1-done-${Date.now()}`,
        role: 'agent',
        content: `Extracted ${chips.length} constraints. Ready to generate the architecture.`,
        chips,
      });
    });
  }, [reqStatus, prdText, addChatMessage, setConstraints, setStageStatus]);

  function handleEdit() {
    setStageStatus('requirements', 'processing');
    setConstraints([]);
    agentRan.current = false;
    addChatMessage('requirements', {
      id: `system-reset-${Date.now()}`,
      role: 'agent',
      content: 'PRD updated. Re-analyzing requirements…',
    });
  }

  function handleGenerateArchitecture() {
    if (!isDone) return;
    advanceStage();
    router.push('/app/architecture');
  }

  return (
    <main
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 40px',
        background: 'var(--lp-bg)',
        overflow: 'hidden',
      }}
      aria-label="Product Requirements panel"
    >
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Product Requirements
        </h1>

        <AnimatePresence>
          {(isProcessing || isDone) && constraints.length > 0 && (
            <motion.span
              key="constraint-badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--lp-accent)',
                background: 'var(--lp-accent-dim)',
                border: '0.5px solid rgba(45,212,191,0.25)',
                borderRadius: '100px',
                padding: '3px 10px',
              }}
              aria-live="polite"
              aria-label={`${constraints.length} constraints extracted`}
            >
              {constraints.length} constraints extracted
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── PRD textarea ─────────────────────────────────────────────────────── */}
      <textarea
        value={prdText}
        onChange={(e) => setPrdText(e.target.value)}
        onFocus={() => setTextareaFocused(true)}
        onBlur={() => setTextareaFocused(false)}
        aria-label="Product requirements document"
        style={{
          flex: 1,
          minHeight: '200px',
          background: 'var(--lp-elevated)',
          border: `0.5px solid ${
            textareaFocused
              ? 'rgba(45,212,191,0.4)'
              : 'var(--lp-border-hover)'
          }`,
          borderRadius: '10px',
          padding: '16px',
          fontSize: '14px',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          color: 'var(--lp-text-primary)',
          resize: 'vertical',
          outline: 'none',
          lineHeight: 1.65,
          transition: 'border-color 150ms ease',
        }}
      />

      {/* ── Status hint ──────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          minHeight: '18px',
          flexShrink: 0,
        }}
        aria-live="polite"
      >
        {isProcessing && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            <PulsingDot />
            Agent 1 is extracting NFR constraints…
          </span>
        )}

        {isDone && (
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            {constraints.length} NFR constraint{constraints.length !== 1 ? 's' : ''} extracted
          </span>
        )}
      </div>

      {/* ── Bottom action row ────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Edit ghost button */}
        <button
          type="button"
          onClick={handleEdit}
          style={{
            padding: '7px 14px',
            background: 'transparent',
            border: '0.5px solid var(--lp-border-hover)',
            borderRadius: '8px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--lp-text-secondary)',
            cursor: 'pointer',
            transition: 'border-color 120ms ease, color 120ms ease',
          }}
          aria-label="Re-run requirements extraction"
        >
          Edit
        </button>

        {/* Generate Architecture primary button */}
        <motion.button
          type="button"
          onClick={handleGenerateArchitecture}
          disabled={!isDone}
          animate={
            genButtonPulsed
              ? { scale: [1, 1.02, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            padding: '7px 18px',
            background: isDone ? 'var(--lp-accent-dim)' : 'transparent',
            border: `0.5px solid ${
              isDone ? 'rgba(45,212,191,0.3)' : 'var(--lp-border-hover)'
            }`,
            borderRadius: '8px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: isDone ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
            cursor: isDone ? 'pointer' : 'not-allowed',
            opacity: isDone ? 1 : 0.5,
            transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease',
          }}
          aria-disabled={!isDone}
          aria-label="Generate architecture from requirements"
        >
          Generate Architecture →
        </motion.button>
      </div>
    </main>
  );
}
