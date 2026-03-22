'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

const TRACE_LINES = [
  { text: '✓ serverless → Lambda          (cost optimization)', type: 'ok' },
  { text: '✓ Lambda → ElastiCache         (no persistent memory)', type: 'ok' },
  { text: '✓ ACID required → Aurora       (managed, serverless-compatible)', type: 'ok' },
  { text: '✗ in-memory cache → BLOCKED    (no Lambda persistence)', type: 'err' },
];

function ConstraintGraph({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 420 220" style={{ width: '100%', overflow: 'visible' }}>
      {/* Edges — draw behind nodes */}

      {/* Lambda → ElastiCache */}
      <motion.line
        x1="130" y1="90" x2="200" y2="55"
        stroke="#22c55e" strokeWidth="1.5"
        initial={{ opacity: 0 }}
        animate={animate ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.6 }}
      />
      <motion.text
        x="155" y="62" fontSize="9" fill="#22c55e" textAnchor="middle"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}}
        transition={{ delay: 0.9 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >REQUIRES</motion.text>

      {/* Lambda → Aurora */}
      <motion.line
        x1="130" y1="100" x2="200" y2="140"
        stroke="#22c55e" strokeWidth="1.5"
        initial={{ opacity: 0 }}
        animate={animate ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.7 }}
      />
      <motion.text
        x="155" y="135" fontSize="9" fill="#22c55e" textAnchor="middle"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}}
        transition={{ delay: 1.0 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >REQUIRES</motion.text>

      {/* Lambda → In-Memory Cache (red dashed) */}
      <motion.line
        x1="130" y1="90" x2="310" y2="90"
        stroke="#ff4d4d" strokeWidth="1.5" strokeDasharray="5,4"
        initial={{ opacity: 0 }}
        animate={animate ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.8 }}
      />
      <motion.text
        x="220" y="82" fontSize="9" fill="#ff4d4d" textAnchor="middle"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}}
        transition={{ delay: 1.1 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >CONFLICTS</motion.text>

      {/* Node: Lambda */}
      <motion.rect x="40" y="72" width="90" height="32" rx="6" fill="#111614" stroke="#2a3628" strokeWidth="1"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.1 }} />
      <motion.circle cx="52" cy="88" r="4" fill="#22c55e"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.1 }} />
      <motion.text x="62" y="93" fontSize="11" fill="#E8E6E1"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.1 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >Lambda</motion.text>

      {/* Node: ElastiCache */}
      <motion.rect x="200" y="30" width="110" height="32" rx="6" fill="#111614" stroke="#2a3628" strokeWidth="1"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.2 }} />
      <motion.circle cx="212" cy="46" r="4" fill="#22c55e"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.2 }} />
      <motion.text x="222" y="51" fontSize="11" fill="#E8E6E1"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >ElastiCache</motion.text>

      {/* Node: Aurora Serverless */}
      <motion.rect x="197" y="122" width="140" height="32" rx="6" fill="#111614" stroke="#2a3628" strokeWidth="1"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.3 }} />
      <motion.circle cx="209" cy="138" r="4" fill="#22c55e"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.3 }} />
      <motion.text x="219" y="143" fontSize="11" fill="#E8E6E1"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.3 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >Aurora Serverless</motion.text>

      {/* Node: In-Memory Cache */}
      <motion.rect x="305" y="72" width="110" height="32" rx="6" fill="#111614" stroke="#ff4d4d" strokeWidth="1" strokeDasharray="4,3"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.4 }} />
      <motion.circle cx="317" cy="88" r="4" fill="#ff4d4d"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.4 }} />
      <motion.text x="327" y="93" fontSize="11" fill="#ff4d4d"
        initial={{ opacity: 0 }} animate={animate ? { opacity: 1 } : {}} transition={{ delay: 0.4 }}
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      >In-Memory Cache</motion.text>
    </svg>
  );
}

export default function GraphEngine() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} style={{ background: 'var(--lp-bg)', padding: '100px 24px' }}>
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
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          THE DIFFERENTIATOR
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}
        >
          <span style={{ color: 'var(--lp-text-primary)' }}>Most AI tools guess your architecture.</span>
          <br />
          <span style={{ color: 'var(--lp-accent)' }}>CloudForge proves it.</span>
        </motion.h2>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '16px',
            color: 'var(--lp-text-secondary)',
            textAlign: 'center',
            maxWidth: '620px',
            margin: '0 auto 64px',
            lineHeight: 1.65,
          }}
        >
          A KuzuDB knowledge graph deterministically validates AWS service compatibility before Claude Sonnet writes a word of explanation.
        </motion.p>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'start',
        }}>
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {[
              'Every architecture recommendation passes through a graph traversal step first. The graph encodes AWS constraints: which services are compatible, which conflict, and which are required given your NFRs.',
              'LangGraph routes your extracted requirements through the graph. It resolves valid paths, marks blocked combinations, and surfaces conflicts. Only the validated path reaches the LLM.',
              "Claude Sonnet explains what the graph proved. It never decides. That's how you get zero hallucinated 'you could use Lambda or maybe ECS or perhaps Fargate' hedging.",
            ].map((para, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '15px', color: 'var(--lp-text-secondary)', lineHeight: 1.7 }}>
                {para}
              </p>
            ))}
          </motion.div>

          {/* Right: graph card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            style={{
              background: '#111614',
              border: '1px solid #1e2620',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: 'var(--lp-accent)', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Constraint Graph
            </div>
            <ConstraintGraph animate={inView} />

            {/* Reasoning trace */}
            <div style={{
              marginTop: '20px',
              background: '#0a0d0b',
              border: '1px solid #1e2620',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '12px',
            }}>
              <div style={{ color: 'var(--lp-text-hint)', marginBottom: '10px', letterSpacing: '0.08em', fontSize: '10px' }}>
                REASONING TRACE
              </div>
              {TRACE_LINES.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.2 + i * 0.08 }}
                  style={{
                    color: line.type === 'ok' ? 'var(--lp-accent)' : '#ff4d4d',
                    marginBottom: i < TRACE_LINES.length - 1 ? '6px' : 0,
                    lineHeight: 1.5,
                  }}
                >
                  {line.text}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
