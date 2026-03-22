'use client';

import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

const PILLS = [
  { label: 'Claude Sonnet 3.5 API', accent: true },
  { label: 'AWS Cloud Control API', accent: false },
  { label: '10 AWS services', accent: false },
  { label: 'Terraform IaC', accent: false },
] as const;

export default function SocialProof() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: EASE }}
      style={{
        borderTop: '1px solid var(--lp-border)',
        borderBottom: '1px solid var(--lp-border)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {PILLS.map((pill) => (
        <div
          key={pill.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: pill.accent ? 'var(--lp-accent-dim)' : 'var(--lp-surface)',
            border: `0.5px solid ${pill.accent ? 'rgba(110,171,133,0.25)' : 'var(--lp-border-hover)'}`,
            borderRadius: '100px',
          }}
        >
          {pill.accent && (
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--lp-accent)',
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: pill.accent ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
              fontWeight: pill.accent ? 500 : 400,
              letterSpacing: '0.01em',
            }}
          >
            {pill.label}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
