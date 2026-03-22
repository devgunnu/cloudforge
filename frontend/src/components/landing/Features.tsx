'use client';

import { motion, useInView } from 'framer-motion';
import { FileText, Network, GitBranch, ShieldCheck, Terminal, Layers } from 'lucide-react';
import { useRef } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

const FEATURES = [
  {
    Icon: FileText,
    title: 'PRD-first',
    desc: "Start with what you're building, not what infrastructure to pick. CloudForge extracts requirements before recommending anything.",
  },
  {
    Icon: Network,
    title: 'Graph-validated',
    desc: 'A KuzuDB constraint graph deterministically validates AWS service compatibility before the LLM writes a single line.',
  },
  {
    Icon: GitBranch,
    title: 'Your GitHub',
    desc: 'CloudForge writes your full codebase and pushes it directly to your repo: not a template, not boilerplate. Production-ready code.',
  },
  {
    Icon: ShieldCheck,
    title: 'Your AWS',
    desc: 'Cross-account IAM role assumption only. No credentials stored. Your infrastructure, your bill, your control.',
  },
  {
    Icon: Terminal,
    title: 'Live deploy log',
    desc: 'Every Terraform operation streams to your browser in real time. Lambda created. IAM attached. VPC peered. Nothing hidden.',
  },
  {
    Icon: Layers,
    title: 'Zero config files',
    desc: 'No YAML, no HCL to write, no AWS console to click through. Every resource is configured through a visual panel.',
  },
] as const;

type FeatureItem = (typeof FEATURES)[number];

function FeatureCard({
  feat,
  index,
  inView,
}: {
  feat: FeatureItem;
  index: number;
  inView: boolean;
}) {
  return (
    <motion.div
      className="lp-card"
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: EASE, delay: 0.1 + index * 0.08 }}
      whileHover={{ y: -2 }}
      style={{
        background: 'var(--lp-surface)',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <feat.Icon size={20} color="var(--lp-accent)" />
      <h3
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--lp-text-primary)',
          margin: 0,
        }}
      >
        {feat.title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '14px',
          color: 'var(--lp-text-secondary)',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {feat.desc}
      </p>
    </motion.div>
  );
}

export default function Features() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      id="features"
      ref={ref}
      style={{ background: 'var(--lp-bg)', padding: '100px 24px' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ textAlign: 'center', marginBottom: '64px' }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 600,
              color: 'var(--lp-text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: '0 0 4px',
            }}
          >
            Everything you need.
          </h2>
          <h2
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 600,
              color: 'var(--lp-text-secondary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Nothing you don&apos;t.
          </h2>
        </motion.div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}
        >
          {FEATURES.map((feat, i) => (
            <FeatureCard key={feat.title} feat={feat} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
