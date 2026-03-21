'use client';

import { motion } from 'framer-motion';
import TerminalAnimation from './TerminalAnimation';
import CanvasMockup from './CanvasMockup';

const EASE = [0.16, 1, 0.3, 1] as const;

interface WordRevealProps {
  text: string;
  accentWord?: string;
  baseDelay?: number;
}

function WordReveal({ text, accentWord, baseDelay = 0 }: WordRevealProps) {
  const words = text.split(' ');
  return (
    <span style={{ display: 'inline' }}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'bottom',
            marginRight: '0.25em',
          }}
        >
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '105%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 0.55,
              ease: EASE,
              delay: baseDelay + i * 0.055,
            }}
          >
            {word === accentWord ? (
              <span style={{ color: 'var(--lp-accent)', fontStyle: 'italic', fontWeight: 400 }}>
                {word}
              </span>
            ) : (
              word
            )}
          </motion.span>
        </span>
      ))}
    </span>
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
      {/* Spotlight glow — underneath content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--lp-spotlight)',
          pointerEvents: 'none',
          animation: 'lp-spotlight-pulse 6s ease-in-out infinite',
        }}
      />

      {/* Animated beam */}
      <div className="lp-beam" aria-hidden="true" />

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 14px',
          background: 'var(--lp-surface)',
          border: '1px solid var(--lp-border-hover)',
          borderRadius: '100px',
          marginBottom: '32px',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'var(--lp-accent)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-text-secondary)',
            letterSpacing: '0.02em',
          }}
        >
          Powered by Claude AI + AWS Cloud Control API
        </span>
      </motion.div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: 'clamp(48px, 7vw, 88px)',
          fontWeight: 600,
          color: 'var(--lp-text-primary)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          textAlign: 'center',
          maxWidth: '820px',
          margin: '0 0 24px',
          position: 'relative',
        }}
      >
        <WordReveal text="AWS infrastructure," baseDelay={0.1} />
        <br />
        <WordReveal text="drawn not written." accentWord="drawn" baseDelay={0.35} />
      </h1>

      {/* Subhead */}
      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '18px',
          color: 'var(--lp-text-secondary)',
          maxWidth: '480px',
          textAlign: 'center',
          lineHeight: 1.65,
          margin: '0 0 40px',
          fontWeight: 400,
          position: 'relative',
        }}
      >
        Drag services onto a canvas. Connect them. Hit deploy.
        CloudForge generates and provisions real Terraform — instantly.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.7 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '80px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
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
            letterSpacing: '-0.01em',
          }}
        >
          Start building free
          <span style={{ fontSize: '17px', lineHeight: 1 }}>→</span>
        </a>
        <a
          href="https://github.com"
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

      {/* Product visual — terminal + canvas mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.8 }}
        style={{
          width: '100%',
          maxWidth: '620px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Glow behind visuals */}
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: '100px',
            background: 'radial-gradient(ellipse at center, rgba(110,171,133,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
            filter: 'blur(20px)',
          }}
        />
        <TerminalAnimation />
        <CanvasMockup />
      </motion.div>
    </section>
  );
}
