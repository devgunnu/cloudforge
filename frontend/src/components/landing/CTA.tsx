'use client';

import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { useRef } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function CTA() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      style={{
        background: 'var(--lp-bg)',
        padding: '120px 24px',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {/* Teal radial glow behind headline */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
          width: '600px',
          height: '400px',
          background:
            'radial-gradient(ellipse at center, rgba(45,212,191,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />

      <div style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: 'clamp(40px, 6vw, 64px)',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            margin: '0 0 20px',
          }}
        >
          From PRD to deployed.
          <br />
          No detours.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '17px',
            color: 'var(--lp-text-secondary)',
            margin: '0 0 40px',
            lineHeight: 1.6,
          }}
        >
          Create an account and start your first project in minutes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '24px',
          }}
        >
          <Link
            href="/signup"
            className="lp-btn-primary"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              padding: '12px 24px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Start building free <span style={{ fontSize: '17px', lineHeight: 1 }}>→</span>
          </Link>
          <a
            href="https://github.com/cloudforge-dev/cloudforge"
            className="lp-btn-ghost"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 400,
              padding: '12px 24px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            View on GitHub
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-text-hint)',
          }}
        >
          Writes your codebase · Deploys your infrastructure · You own everything
        </motion.p>
      </div>
    </section>
  );
}
