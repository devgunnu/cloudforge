'use client';

import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Step {
  number: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Draw your architecture',
    description:
      'Drag Lambda, RDS, S3, VPC and 6 more services onto an infinite canvas. Connect them with edges to define your data flow.',
  },
  {
    number: '02',
    title: 'Configure in the panel',
    description:
      'Click any node to open its properties. Set runtime, memory, instance class, CIDR ranges — every AWS option, no YAML.',
  },
  {
    number: '03',
    title: 'Deploy with one click',
    description:
      'Claude reads your topology, generates production-grade Terraform, and provisions real AWS resources via Cloud Control API.',
  },
];

export default function HowItWorks() {
  return (
    <section
      style={{
        padding: '120px 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '72px',
        }}
      >
        <div
          style={{
            height: '1px',
            width: '32px',
            background: 'var(--lp-accent)',
            opacity: 0.6,
            flexShrink: 0,
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
          How it works
        </span>
      </motion.div>

      {/* Steps grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2px',
        }}
      >
        {STEPS.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: EASE, delay: i * 0.12 }}
            style={{
              padding: '32px 40px 40px 0',
              borderTop: '1px solid var(--lp-border)',
            }}
          >
            {/* Step number */}
            <div
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-accent)',
                letterSpacing: '0.1em',
                marginBottom: '20px',
                opacity: 0.8,
              }}
            >
              {step.number}
            </div>

            {/* Title */}
            <h3
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '20px',
                fontWeight: 500,
                color: 'var(--lp-text-primary)',
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                marginBottom: '12px',
              }}
            >
              {step.title}
            </h3>

            {/* Description */}
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '15px',
                color: 'var(--lp-text-secondary)',
                lineHeight: 1.7,
                fontWeight: 400,
              }}
            >
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
