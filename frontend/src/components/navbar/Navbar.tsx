'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useCanvasStore } from '@/store/canvasStore';
import type { DeployStatus } from '@/store/canvasStore';

function DeployButtonContent({ status }: { status: DeployStatus }) {
  if (status === 'idle') {
    return <span key="idle">$ deploy --prod</span>;
  }
  if (status === 'generating') {
    return (
      <span key="generating" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cf-amber)' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--cf-amber)',
            display: 'inline-block',
            animation: 'blink 0.8s step-end infinite',
          }}
        />
        $ generating...
      </span>
    );
  }
  if (status === 'deploying') {
    return (
      <span key="deploying" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cf-amber)' }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle cx="6" cy="6" r="5" fill="none" stroke="var(--cf-amber)" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
        </svg>
        $ deploying...
      </span>
    );
  }
  if (status === 'live') {
    return (
      <span key="live" style={{ color: 'var(--cf-green)' }}>
        ✓ live
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span key="error" style={{ color: 'var(--cf-red)' }}>
        ✗ failed
      </span>
    );
  }
  return null;
}

export default function Navbar() {
  const nodes = useCanvasStore((s) => s.nodes);
  const deployStatus = useCanvasStore((s) => s.deployStatus);
  const startDeploy = useCanvasStore((s) => s.startDeploy);
  const resetDeploy = useCanvasStore((s) => s.resetDeploy);
  const toggleTopologyPreview = useCanvasStore((s) => s.toggleTopologyPreview);
  const showTopologyPreview = useCanvasStore((s) => s.showTopologyPreview);

  const isDeploying = deployStatus === 'generating' || deployStatus === 'deploying';
  const nodeCount = nodes.length;

  const handleDeploy = () => {
    if (deployStatus === 'error') {
      resetDeploy();
      return;
    }
    if (deployStatus === 'idle') {
      void startDeploy();
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <nav
        style={{
          height: '56px',
          background: 'var(--cf-bg-surface)',
          borderBottom: '0.5px solid var(--cf-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '16px',
            color: 'var(--cf-green)',
            fontWeight: 600,
            userSelect: 'none',
            marginRight: '8px',
          }}
        >
          CloudForge
          <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
        </div>

        {/* Back to landing */}
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: 'var(--cf-text-hint)',
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--cf-text-muted)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--cf-text-hint)'; }}
        >
          ← home
        </Link>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Topology preview toggle */}
        <button
          onClick={toggleTopologyPreview}
          style={{
            background: showTopologyPreview ? 'var(--cf-bg-elevated)' : 'transparent',
            border: `0.5px solid ${showTopologyPreview ? 'var(--cf-border-hover)' : 'var(--cf-border)'}`,
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: showTopologyPreview ? 'var(--cf-cyan)' : 'var(--cf-text-muted)',
            transition: 'all 150ms ease',
          }}
        >
          {'{ }'} Topology
        </button>

        {/* Resource count pill */}
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            background: 'var(--cf-bg-elevated)',
            border: '0.5px solid var(--cf-border-hover)',
            color: 'var(--cf-text-muted)',
            borderRadius: '6px',
            padding: '4px 10px',
          }}
        >
          {nodeCount} resource{nodeCount !== 1 ? 's' : ''}
        </div>

        {/* Deploy button */}
        <button
          onClick={handleDeploy}
          disabled={isDeploying || nodeCount === 0}
          style={{
            background: deployStatus === 'error'
              ? 'rgba(255,77,77,0.10)'
              : deployStatus === 'live'
              ? 'rgba(0,255,135,0.20)'
              : 'var(--cf-green-dim)',
            border: `0.5px solid ${
              deployStatus === 'error'
                ? 'var(--cf-red)'
                : deployStatus === 'live'
                ? 'var(--cf-green)'
                : 'var(--cf-green)'
            }`,
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: isDeploying || nodeCount === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '13px',
            color: deployStatus === 'error' ? 'var(--cf-red)' : 'var(--cf-green)',
            opacity: nodeCount === 0 ? 0.5 : 1,
            transition: 'background 150ms ease',
            minWidth: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            if (!isDeploying && nodeCount > 0 && deployStatus === 'idle') {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,135,0.20)';
            }
          }}
          onMouseLeave={(e) => {
            if (deployStatus === 'idle') {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--cf-green-dim)';
            }
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={deployStatus}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <DeployButtonContent status={deployStatus} />
            </motion.span>
          </AnimatePresence>
        </button>
      </nav>
    </>
  );
}
