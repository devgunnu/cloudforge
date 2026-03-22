'use client';

import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import {
  useForgeStore,
  FORGE_STAGE_ORDER,
  FORGE_STAGE_LABELS,
  type ForgeStage,
} from '@/store/forgeStore';

// ── Stage breadcrumb ──────────────────────────────────────────────────────────

function StageBreadcrumb() {
  const { activeStage, stageStatus, navigateToStage } = useForgeStore();
  const router = useRouter();
  const params = useParams();
  const projectId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  function handleStageClick(stage: ForgeStage) {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && stageStatus[stage] === 'locked') return;
    navigateToStage(stage);
    router.push(`/app/${projectId}/${stage}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
      role="tablist"
      aria-label="Build stages"
    >
      {FORGE_STAGE_ORDER.map((stage, idx) => {
        const status = stageStatus[stage];
        const isActive = stage === activeStage;
        const isDone = status === 'done';
        const isLocked = status === 'locked';

        const isDev = process.env.NODE_ENV === 'development';
        const labelColor = isLocked && !isDev
          ? 'var(--lp-text-hint)'
          : isActive
            ? 'var(--lp-text-primary)'
            : 'var(--lp-text-secondary)';

        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Divider between tabs */}
            {idx > 0 && (
              <span
                aria-hidden="true"
                style={{
                  color: 'var(--lp-text-hint)',
                  fontSize: '12px',
                  margin: '0 2px',
                  userSelect: 'none',
                }}
              >
                /
              </span>
            )}

            {/* Tab */}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isLocked && process.env.NODE_ENV !== 'development'}
              onClick={() => handleStageClick(stage)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                background: 'transparent',
                border: 'none',
                cursor: isLocked && process.env.NODE_ENV !== 'development' ? 'not-allowed' : 'pointer',
                borderRadius: '7px',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                color: labelColor,
                transition: 'color 150ms ease',
                userSelect: 'none',
              }}
            >
              {/* Step indicator */}
              <span
                aria-hidden="true"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: isDone
                    ? 'rgba(52,211,153,0.15)'
                    : isActive
                      ? 'var(--lp-accent-dim)'
                      : 'var(--lp-elevated)',
                  color: isDone
                    ? '#34d399'
                    : isActive
                      ? 'var(--lp-accent)'
                      : 'var(--lp-text-hint)',
                  border: `0.5px solid ${isDone ? 'rgba(52,211,153,0.3)' : isActive ? 'rgba(45,212,191,0.3)' : 'var(--lp-border)'}`,
                  flexShrink: 0,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                }}
              >
                {isDone ? '✓' : idx + 1}
              </span>

              {FORGE_STAGE_LABELS[stage]}

              {/* Active underline — slides between tabs with Framer Motion */}
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="forge-stage-indicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '8px',
                      right: '8px',
                      height: '1.5px',
                      borderRadius: '100px',
                      background: 'var(--lp-accent)',
                    }}
                    aria-hidden="true"
                  />
                )}
              </AnimatePresence>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Deploy button ─────────────────────────────────────────────────────────────

function DeployButton() {
  const { stageStatus, setDeployModalOpen } = useForgeStore();
  const buildDone = stageStatus.build === 'done';

  return (
    <button
      type="button"
      onClick={() => buildDone && setDeployModalOpen(true)}
      aria-disabled={!buildDone}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        borderRadius: '8px',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '13px',
        fontWeight: 500,
        cursor: buildDone ? 'pointer' : 'not-allowed',
        transition: 'all 150ms ease',
        ...(buildDone
          ? {
              background: 'var(--lp-accent-dim)',
              border: '0.5px solid rgba(45,212,191,0.35)',
              color: 'var(--lp-accent)',
            }
          : {
              background: 'rgba(255,255,255,0.02)',
              border: '0.5px solid var(--lp-border)',
              color: 'var(--lp-text-hint)',
              // Crosshatch overlay on locked state
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.015) 4px, rgba(255,255,255,0.015) 5px)',
            }),
      }}
      aria-label={buildDone ? 'Deploy to AWS' : 'Deploy to AWS — locked until build completes'}
    >
      {!buildDone && (
        <Lock
          size={11}
          aria-hidden="true"
          style={{ opacity: 0.5 }}
        />
      )}
      Deploy to AWS
      {!buildDone && (
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '9px',
            letterSpacing: '0.05em',
            color: 'var(--lp-text-hint)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '4px',
            padding: '1px 5px',
            background: 'var(--lp-elevated)',
          }}
        >
          BUILD FIRST
        </span>
      )}
    </button>
  );
}

// ── Top nav ───────────────────────────────────────────────────────────────────

export default function ForgeTopNav() {
  const { projectName } = useForgeStore();

  return (
    <header
      style={{
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--lp-surface)',
        borderBottom: '0.5px solid var(--lp-border)',
        position: 'relative',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left — logo + project name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
        <span
          aria-hidden="true"
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--lp-accent)',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ◈
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          CloudForge
        </span>

        <span aria-hidden="true" style={{ color: 'var(--lp-border-hover)', fontSize: '14px' }}>/</span>

        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--lp-text-secondary)',
            background: 'var(--lp-elevated)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '5px',
            padding: '2px 8px',
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={projectName}
          aria-label={`Project: ${projectName}`}
        >
          {projectName}
        </span>
      </div>

      {/* Center — stage breadcrumb */}
      <StageBreadcrumb />

      {/* Right — deploy button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: '180px' }}>
        <DeployButton />
      </div>
    </header>
  );
}
