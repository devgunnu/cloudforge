'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS = [
  {
    num: '01',
    title: 'Upload your PRD',
    desc: "Connect GitHub once. Create a project. Upload your Product Requirements Document (PDF or plain text). CloudForge's agent reads it and opens a refinement conversation immediately.",
  },
  {
    num: '02',
    title: 'Refine with an AI agent',
    desc: 'The agent asks targeted clarifying questions based on your actual requirements, not generic ones. You answer. It synthesizes a final structured spec. This becomes the source of truth for everything downstream.',
  },
  {
    num: '03',
    title: 'Graph-validated architecture',
    desc: 'CloudForge runs your requirements through a LangGraph pipeline backed by a KuzuDB knowledge graph of AWS architecture constraints. The graph engine deterministically validates service compatibility, with no hallucinated recommendations. Claude Sonnet explains the reasoning. You finalize.',
  },
  {
    num: '04',
    title: 'Codebase written and committed',
    desc: 'CloudForge generates a production-ready codebase matched to your finalized architecture: framework, structure, and Terraform infra included. Review it in the UI, then one click pushes it directly to your GitHub repo.',
  },
  {
    num: '05',
    title: 'Deploy to your own AWS',
    desc: 'Connect AWS per-project via IAM role assumption. No credentials stored. CloudForge triggers CI/CD, provisions every resource through the AWS Cloud Control API, and streams the live log back to your browser in real time.',
  },
] as const;

type Step = typeof STEPS[number];

function StepRow({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const isEven = index % 2 === 1;

  return (
    <>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: -20 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5, ease: EASE, delay: 0.05 * index }}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '32px',
          padding: '40px 32px',
          background: isEven ? '#0f1210' : 'transparent',
          alignItems: 'start',
        }}
      >
        <div>
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--lp-accent)',
            display: 'block',
            marginBottom: '8px',
          }}>
            {step.num}
          </span>
          <h3 style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '17px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            lineHeight: 1.3,
          }}>
            {step.title}
          </h3>
        </div>
        <p style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '15px',
          color: 'var(--lp-text-secondary)',
          lineHeight: 1.7,
          marginTop: '8px',
        }}>
          {step.desc}
        </p>
      </motion.div>
      {index < STEPS.length - 1 && (
        <hr style={{ border: 'none', borderTop: '1px solid var(--lp-border)', margin: '0' }} />
      )}
    </>
  );
}

export default function HowItWorks() {
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: '-100px' });

  return (
    <section
      id="how-it-works"
      style={{ background: 'var(--lp-bg)', padding: '100px 0' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        {/* Section label */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--lp-accent)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '12px',
            textAlign: 'center',
          }}
        >
          HOW IT WORKS
        </motion.div>
      </div>

      {/* Steps — full width for edge-to-edge bg on even rows */}
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ border: '1px solid var(--lp-border)', borderRadius: '12px', overflow: 'hidden' }}>
          {STEPS.map((step, i) => (
            <StepRow key={step.num} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
