'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function CTA() {
  return (
    <section
      style={{
        padding: '120px 24px 160px',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--lp-bg)',
      }}
    >
      {/* Top border */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '1100px',
          height: '1px',
          background: 'var(--lp-border)',
        }}
      />

      {/* Subtle accent glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '300px',
          background:
            'radial-gradient(ellipse at center, rgba(110,171,133,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{
          maxWidth: '560px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '16px',
          }}
        >
          Start in 60 seconds.
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '17px',
            color: 'var(--lp-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '40px',
            fontWeight: 400,
          }}
        >
          Create an account and start building cloud infrastructure right away.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/signup"
            className="lp-btn-primary"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              padding: '12px 28px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Get Started →
          </Link>

          <Link
            href="/login"
            className="lp-nav-link"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '14px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            Sign in to existing account
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
