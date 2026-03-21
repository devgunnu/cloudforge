// ============================================================
// BACKEND HOOK: Real-time deployment logs
// Future: replace deployLog mock array with SSE stream
// from the Claude agent reporting actual Terraform output
// Connect via: const es = new EventSource('/api/deploy/stream')
// ============================================================
'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCanvasStore } from '@/store/canvasStore';

function LogLine({ line, index }: { line: string; index: number }) {
  const isSuccess = line.startsWith('✓');
  const isError = line.startsWith('✗');
  const color = isSuccess
    ? 'var(--cf-green)'
    : isError
    ? 'var(--cf-red)'
    : 'var(--cf-cyan)';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '12px',
        color,
        lineHeight: '1.7',
      }}
    >
      {line}
    </motion.div>
  );
}

export default function DeployLog() {
  const deployStatus = useCanvasStore((s) => s.deployStatus);
  const deployLog = useCanvasStore((s) => s.deployLog);
  const deployError = useCanvasStore((s) => s.deployError);
  const resetDeploy = useCanvasStore((s) => s.resetDeploy);
  const [borderFlash, setBorderFlash] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isVisible =
    deployStatus === 'generating' ||
    deployStatus === 'deploying' ||
    deployStatus === 'live' ||
    deployStatus === 'error';

  const isDone = deployStatus === 'live' || deployStatus === 'error';

  // Flash border on live
  useEffect(() => {
    if (deployStatus === 'live') {
      setBorderFlash(true);
      const t = setTimeout(() => setBorderFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [deployStatus]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [deployLog]);

  const borderColor = borderFlash
    ? 'var(--cf-green)'
    : deployStatus === 'error'
    ? 'rgba(255,77,77,0.30)'
    : 'rgba(0,255,135,0.30)';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            width: '420px',
            height: '280px',
            background: 'var(--cf-bg-surface)',
            border: `0.5px solid ${borderColor}`,
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 50,
            transition: 'border-color 150ms ease',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '0.5px solid var(--cf-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--cf-text-hint)',
              }}
            >
              // deploy log
            </span>
            {isDone && (
              <button
                onClick={resetDeploy}
                style={{
                  background: 'none',
                  border: '0.5px solid var(--cf-border-hover)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '10px',
                  color: 'var(--cf-text-muted)',
                }}
              >
                dismiss
              </button>
            )}
          </div>

          {/* Log lines */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--cf-bg-elevated) transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {deployLog.map((line, i) => (
              <LogLine key={`${line}-${i}`} line={line} index={i} />
            ))}
            {deployError && (
              <LogLine line={`✗ ${deployError}`} index={deployLog.length} />
            )}
            {/* Blinking cursor while deploying */}
            {!isDone && (
              <span
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '12px',
                  color: 'var(--cf-green)',
                  animation: 'blink 1s step-end infinite',
                }}
              >
                ▌
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
