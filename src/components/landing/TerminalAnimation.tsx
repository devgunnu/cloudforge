'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalLine {
  text: string;
  color: string;
  dim: boolean;
}

const LINES: TerminalLine[] = [
  { text: '$ cloudforge deploy --env prod', color: 'var(--lp-text-primary)', dim: false },
  { text: '  ↳ Parsing architecture graph', color: 'var(--lp-text-secondary)', dim: true },
  { text: '  ↳ Generating Terraform modules', color: 'var(--lp-text-secondary)', dim: true },
  { text: '  ↳ Provisioning Lambda × 3', color: 'var(--lp-text-secondary)', dim: true },
  { text: '  ↳ Configuring IAM policies', color: 'var(--lp-text-secondary)', dim: true },
  { text: '', color: '', dim: false },
  { text: '  ✓ 4 resources live  •  us-east-1  •  4.2s', color: 'var(--lp-accent)', dim: false },
];

export default function TerminalAnimation() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function showNext(index: number): void {
      if (index < LINES.length) {
        timeout = setTimeout(
          () => {
            setVisibleCount(index + 1);
            if (index + 1 === LINES.length) setDone(true);
            showNext(index + 1);
          },
          LINES[index].text === '' ? 150 : 380,
        );
      } else {
        timeout = setTimeout(() => {
          setVisibleCount(0);
          setDone(false);
          setTimeout(() => showNext(0), 200);
        }, 3500);
      }
    }

    showNext(0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        borderRadius: '14px',
        background: 'var(--lp-surface)',
        border: '1px solid var(--lp-border-hover)',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: '44px',
          background: 'var(--lp-elevated)',
          borderBottom: '1px solid var(--lp-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'relative',
        }}
      >
        {/* Traffic lights — monochrome to match Direction C */}
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: '#45474F',
              }}
            />
          ))}
        </div>

        {/* Centered title */}
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: 'var(--lp-text-hint)',
            letterSpacing: '0.02em',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          cloudforge
        </span>

        {/* Spacer to balance the traffic lights */}
        <div style={{ width: '50px' }} aria-hidden="true" />
      </div>

      {/* Terminal body */}
      <div
        style={{
          padding: '20px 24px 24px',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        <AnimatePresence>
          {LINES.slice(0, visibleCount).map((line, i) => (
            <motion.div
              key={`${i}-${line.text}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '13px',
                lineHeight: '1.7',
                color: line.color || 'transparent',
                letterSpacing: '0.01em',
              }}
            >
              {line.text || '\u00A0'}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Blinking cursor — visible only while still typing */}
        {!done && visibleCount < LINES.length && (
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '13px',
              color: 'var(--lp-accent)',
              animation: 'blink 1s step-end infinite',
              lineHeight: '1.7',
            }}
            aria-hidden="true"
          >
            ▋
          </span>
        )}
      </div>
    </div>
  );
}
