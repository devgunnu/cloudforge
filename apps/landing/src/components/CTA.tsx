'use client';

import { useState, type FormEvent } from 'react';

export default function CTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // ============================================================
    // BACKEND HOOK: Waitlist signup
    // Future: POST email to /api/waitlist or a service like Loops
    // ============================================================
    setSubmitted(true);
  };

  return (
    <section
      style={{
        padding: '96px 24px 128px',
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '32px',
      }}
    >
      {/* Headline */}
      <h2
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: 'clamp(24px, 4vw, 40px)',
          fontWeight: 600,
          color: 'var(--cf-text-primary)',
          lineHeight: 1.2,
        }}
      >
        Start building your first architecture in{' '}
        <span style={{ color: 'var(--cf-green)' }}>60 seconds</span>
      </h2>

      {/* Form or success */}
      {submitted ? (
        <p
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '14px',
            color: 'var(--cf-green)',
          }}
        >
          ✓ You&apos;re on the list. We&apos;ll ping you when it ships.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '380px' }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="$ enter your email"
            required
            aria-label="Email address for waitlist"
            style={{
              flex: 1,
              background: 'var(--cf-bg-surface)',
              border: '0.5px solid var(--cf-border-hover)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '14px',
              color: 'var(--cf-text-primary)',
              outline: 'none',
              transition: 'border-color 150ms ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--cf-green)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--cf-border-hover)';
            }}
          />
          <button
            type="submit"
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              background: 'var(--cf-green-dim)',
              border: '0.5px solid var(--cf-green)',
              borderRadius: '8px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '13px',
              color: 'var(--cf-green)',
              cursor: 'pointer',
              transition: 'background 150ms ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,135,0.20)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--cf-green-dim)';
            }}
          >
            → Join waitlist
          </button>
        </form>
      )}
    </section>
  );
}
