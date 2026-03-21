'use client';

import { motion } from 'framer-motion';
import {
  Layers,
  Cpu,
  Globe2,
  ActivitySquare,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: 'No config files',
    description:
      'Draw your infrastructure instead of writing YAML. Every AWS resource is a draggable node with a visual properties panel.',
  },
  {
    icon: Cpu,
    title: 'Claude-generated Terraform',
    description:
      'Your diagram is converted to production-grade HCL by Claude Sonnet — reviewed, idiomatic, and ready to apply.',
  },
  {
    icon: Globe2,
    title: 'Real provisioning',
    description:
      'Not a simulator. CloudForge talks directly to the AWS Cloud Control API and creates live resources in your account.',
  },
  {
    icon: ActivitySquare,
    title: 'Live deploy log',
    description:
      'Watch every Terraform operation stream in real time. Lambda created. IAM role attached. VPC peered. All of it.',
  },
  {
    icon: GitBranch,
    title: 'Topology as code',
    description:
      'Every architecture exports as a typed JSON schema you can version, share, and restore — infrastructure as a commit.',
  },
  {
    icon: ShieldCheck,
    title: 'Type-safe contract',
    description:
      'The CloudForgeTopology schema is the single source of truth between your diagram and the Terraform generator. No drift.',
  },
];

export default function Features() {
  return (
    <section
      style={{
        padding: '120px 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ marginBottom: '72px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              height: '1px',
              width: '32px',
              background: 'var(--lp-accent)',
              opacity: 0.6,
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
            Features
          </span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            maxWidth: '500px',
          }}
        >
          Everything you need.{' '}
          <span
            style={{ color: 'var(--lp-text-secondary)', fontWeight: 400 }}
          >
            Nothing you don&apos;t.
          </span>
        </h2>
      </motion.div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1px',
          background: 'var(--lp-border)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--lp-border)',
        }}
      >
        {FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              className="lp-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.6,
                ease: EASE,
                delay: (i % 3) * 0.08,
              }}
              style={{
                padding: '32px',
                background: 'var(--lp-bg)',
                borderRadius: 0,
                border: 'none',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--lp-accent-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} style={{ color: 'var(--lp-accent)' }} />
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--lp-text-primary)',
                  letterSpacing: '-0.01em',
                  marginBottom: '8px',
                  lineHeight: 1.3,
                }}
              >
                {feature.title}
              </h3>

              {/* Description */}
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '14px',
                  color: 'var(--lp-text-secondary)',
                  lineHeight: 1.7,
                  fontWeight: 400,
                }}
              >
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
