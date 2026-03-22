'use client';

import { motion } from 'framer-motion';
import { FileText, MessageSquare, Network, GitCommit, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Stage {
  Icon: React.ElementType;
  name: string;
  desc: string;
}

const STAGES: Stage[] = [
  { Icon: FileText, name: 'PRD Upload', desc: 'Claude reads it.' },
  { Icon: MessageSquare, name: 'AI Refinement', desc: 'Fills the gaps.' },
  { Icon: Network, name: 'Final Architecture', desc: 'Graph-validated.' },
  { Icon: GitCommit, name: 'Code Generation', desc: 'To your GitHub.' },
  { Icon: Zap, name: 'AWS Deploy', desc: 'Your account.' },
];

const TERMINAL_LINES = [
  '✓ Architecture validated  ·  3 components  ·  0 conflicts',
  '✓ Scaffold committed  →  github.com/user/my-app',
  '✓ 4 resources live  ·  us-east-1  ·  4.2s',
];

function PipelineVisual() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      {/* Cards row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {STAGES.map((stage, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.2 }}
              style={{
                background: '#111614',
                border: `1px solid ${activeStage === i ? 'var(--lp-accent)' : '#1e2620'}`,
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px',
                boxShadow:
                  activeStage === i
                    ? '0 0 0 1px rgba(45,212,191,0.4), 0 0 20px rgba(45,212,191,0.1)'
                    : 'none',
                transition: 'border-color 300ms ease, box-shadow 300ms ease',
              }}
            >
              <stage.Icon size={20} color="var(--lp-accent)" />
              <span
                style={{
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--lp-text-primary)',
                  textAlign: 'center',
                }}
              >
                {stage.name}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '11px',
                  color: 'var(--lp-text-secondary)',
                  textAlign: 'center',
                }}
              >
                {stage.desc}
              </span>
            </motion.div>

            {/* Arrow between cards */}
            {i < STAGES.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.2 }}
                style={{
                  padding: '0 8px',
                  color: 'var(--lp-accent)',
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                →
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Terminal output */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        style={{
          marginTop: '20px',
          background: '#0a0d0b',
          border: '1px solid #1e2620',
          borderRadius: '8px',
          padding: '16px 20px',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '13px',
        }}
      >
        {TERMINAL_LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7 + i * 0.12 }}
            style={{
              color: i === TERMINAL_LINES.length - 1 ? 'var(--lp-accent)' : '#9CA3AF',
              marginBottom: i < TERMINAL_LINES.length - 1 ? '6px' : 0,
            }}
          >
            {line}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default function Hero() {
  return (
    <section
      className="lp-hero-dotgrid"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--lp-bg)',
      }}
    >
      {/* Spotlight glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--lp-spotlight)',
          pointerEvents: 'none',
          animation: 'lp-spotlight-pulse 6s ease-in-out infinite',
        }}
      />
      <div className="lp-beam" aria-hidden="true" />


      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: 'clamp(36px, 5vw, 64px)',
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          textAlign: 'center',
          maxWidth: '700px',
          margin: '0 0 24px',
          position: 'relative',
          color: 'var(--lp-text-primary)',
        }}
      >
        <span style={{ display: 'block' }}>Your PRD.</span>
        <span style={{ display: 'block' }}>Your GitHub.</span>
        <span style={{ display: 'block' }}>Your AWS.</span>
        <span style={{ display: 'block', textDecoration: 'underline', textDecorationColor: 'var(--lp-accent)', textUnderlineOffset: '6px', textDecorationThickness: '2px' }}>Deployed.</span>
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '18px',
          color: 'var(--lp-text-secondary)',
          maxWidth: '520px',
          textAlign: 'center',
          lineHeight: 1.65,
          margin: '0 0 28px',
          fontWeight: 400,
          position: 'relative',
        }}
      >
        Upload your product requirements. An AI agent refines them.{' '}
        A graph engine validates your architecture, no hallucinations.{' '}
        Your codebase gets written and committed to GitHub. Your AWS goes live.
      </motion.p>

      {/* Teal rule separator */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.45 }}
        style={{
          width: '60px',
          height: '2px',
          background: 'var(--lp-accent)',
          borderRadius: '2px',
          marginBottom: '28px',
          position: 'relative',
          transformOrigin: 'center',
        }}
      />

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '60px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Link
          href="/signup"
          className="lp-btn-primary"
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 500,
            padding: '16px 24px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '-0.01em',
          }}
        >
          Start building free <span style={{ fontSize: '17px', lineHeight: 1 }}>→</span>
        </Link>
        <Link
          href="/dashboard?demo=true"
          className="lp-btn-ghost"
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 400,
            padding: '16px 24px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: '0.5px solid rgba(45,212,191,0.5)',
            color: 'var(--lp-accent)',
          }}
        >
          Try Live Demo →
        </Link>
        <a
          href="https://github.com/cloudforge-dev/cloudforge"
          className="lp-btn-ghost"
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 400,
            padding: '16px 24px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: '0.5px solid rgba(255,255,255,0.5)',
          }}
        >
          View on GitHub
        </a>
      </motion.div>

      {/* Pipeline visual */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}
        style={{ width: '100%', position: 'relative' }}
      >
        <PipelineVisual />
      </motion.div>
    </section>
  );
}
