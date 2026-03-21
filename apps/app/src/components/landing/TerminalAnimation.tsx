'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LINES = [
  { text: '$ cloudforge init', color: 'var(--cf-text-primary)' },
  { text: '→ Scanning architecture graph...', color: 'var(--cf-cyan)' },
  { text: '→ Generating Terraform modules...', color: 'var(--cf-cyan)' },
  { text: '→ Provisioning Lambda function...', color: 'var(--cf-cyan)' },
  { text: '→ Configuring IAM policies...', color: 'var(--cf-cyan)' },
  { text: '✓ 4 resources deployed in 4.2s', color: 'var(--cf-green)', bold: true },
] as const;

type Line = (typeof LINES)[number];

export default function TerminalAnimation() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function showNextLine(index: number) {
      if (index < LINES.length) {
        timeout = setTimeout(() => {
          setVisibleCount(index + 1);
          showNextLine(index + 1);
        }, 400);
      } else {
        // Reset and loop after 3s pause
        timeout = setTimeout(() => {
          setVisibleCount(0);
          setTimeout(() => showNextLine(0), 100);
        }, 3000);
      }
    }

    showNextLine(0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      style={{
        width: '380px',
        borderRadius: '12px',
        background: 'var(--cf-bg-surface)',
        border: '0.5px solid var(--cf-border)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: '36px',
          background: 'var(--cf-bg-elevated)',
          borderBottom: '0.5px solid var(--cf-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff4d4d' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffb300' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff87' }} />
        </div>
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: 'var(--cf-text-muted)',
            marginLeft: '4px',
          }}
        >
          cloudforge — bash
        </span>
      </div>

      {/* Terminal body */}
      <div
        style={{
          padding: '16px',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <AnimatePresence>
          {(LINES.slice(0, visibleCount) as readonly Line[]).map((line, i) => (
            <motion.div
              key={`${i}-${line.text}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '12px',
                color: line.color,
                fontWeight: 'bold' in line && line.bold ? 500 : 400,
                lineHeight: '1.6',
              }}
            >
              {line.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Blinking cursor */}
        {visibleCount < LINES.length && (
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
    </div>
  );
}
