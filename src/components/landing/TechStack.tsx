'use client';

import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

interface TechItem {
  name: string;
  note: string;
}

const TECH: TechItem[] = [
  { name: 'Next.js 15', note: 'App Router' },
  { name: 'React Flow', note: 'Canvas' },
  { name: 'Claude API', note: 'Sonnet' },
  { name: 'AWS CCApi', note: 'Provisioning' },
  { name: 'Terraform', note: 'IaC' },
  { name: 'Zustand', note: 'State' },
];

export default function TechStack() {
  return (
    <section
      style={{
        padding: '80px 24px 120px',
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
      }}
    >
      {/* Label */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            height: '1px',
            width: '60px',
            background: 'var(--lp-border-hover)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--lp-text-hint)',
          }}
        >
          Built with
        </span>
        <div
          style={{
            height: '1px',
            width: '60px',
            background: 'var(--lp-border-hover)',
          }}
        />
      </motion.div>

      {/* Pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        {TECH.map((t, i) => (
          <motion.div
            key={t.name}
            className="lp-card"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.05 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: 'var(--lp-surface)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--lp-text-primary)',
              }}
            >
              {t.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-text-hint)',
                paddingLeft: '2px',
              }}
            >
              {t.note}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
