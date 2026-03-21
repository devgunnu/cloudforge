'use client';

import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// BACKEND HOOK: Waitlist signup
// POST email to /api/waitlist or Loops/Resend
// ============================================================

const EASE = [0.16, 1, 0.3, 1] as const;

export default function CTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

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
          Join the waitlist for early access, or open the builder now — no
          account required.
        </p>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              {/* Confirmation badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 20px',
                  background: 'var(--lp-accent-dim)',
                  border: '1px solid rgba(110,171,133,0.2)',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--lp-accent)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '14px',
                    color: 'var(--lp-accent)',
                    fontWeight: 500,
                  }}
                >
                  You&apos;re on the list — we&apos;ll be in touch.
                </span>
              </div>

              <a
                href="/builder"
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
                Try the builder now →
              </a>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  display: 'flex',
                  gap: '8px',
                  width: '100%',
                  maxWidth: '420px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  aria-label="Email address for waitlist"
                  className="lp-input"
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '15px',
                  }}
                />
                <button
                  type="submit"
                  className="lp-btn-primary"
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '15px',
                    fontWeight: 500,
                    padding: '12px 20px',
                    borderRadius: '10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Join waitlist
                </button>
              </form>

              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  color: 'var(--lp-text-hint)',
                }}
              >
                or{' '}
                <a
                  href="/builder"
                  className="lp-nav-link"
                  style={{
                    color: 'var(--lp-accent)',
                    opacity: 0.8,
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '13px',
                  }}
                >
                  open the builder directly →
                </a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
