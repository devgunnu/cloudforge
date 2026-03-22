'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

const problems = [
  'Write a PRD nobody reads again',
  'Copy-paste Terraform from Stack Overflow',
  'Manually provision resources and pray',
];

const solutions = [
  'Agent refines your PRD into a spec',
  'Graph-validated architecture, no guesswork',
  'One click. Real resources. Streamed live.',
];

export default function ProblemSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      style={{
        background: 'var(--lp-bg)',
        padding: '100px 24px',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--lp-accent)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '48px',
            textAlign: 'center',
          }}
        >
          THE PROBLEM
        </motion.div>

        {/* Two-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
        }}>
          {/* Problem card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            style={{
              background: 'var(--lp-surface)',
              border: '1px solid var(--lp-border)',
              borderLeft: '3px solid rgba(255, 77, 77, 0.5)',
              borderRadius: '12px',
              padding: '32px',
            }}
          >
            <h3 style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--lp-text-primary)',
              marginBottom: '24px',
            }}>
              How cloud projects actually go
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {problems.map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <XCircle size={16} color="#ff4d4d" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '14px', color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Solution card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            style={{
              background: 'var(--lp-surface)',
              border: '1px solid var(--lp-border)',
              borderLeft: '3px solid rgba(45, 212, 191, 0.5)',
              borderRadius: '12px',
              padding: '32px',
            }}
          >
            <h3 style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--lp-text-primary)',
              marginBottom: '24px',
            }}>
              How CloudForge does it
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {solutions.map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <CheckCircle2 size={16} color="var(--lp-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '14px', color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
