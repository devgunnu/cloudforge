'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import WaitlistForm from './WaitlistForm';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Docs', href: '#' },
] as const;

function WaitlistModal({ onClose }: { onClose: () => void }) {
  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Escape key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSuccess = useCallback(() => {
    setTimeout(onClose, 2000);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0d0f13',
          border: '1px solid var(--lp-border)',
          borderRadius: '12px',
          padding: '32px',
          minWidth: '420px',
          maxWidth: '90vw',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--lp-text-secondary)',
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
        >
          ×
        </button>

        <h2
          id="waitlist-modal-title"
          style={{
            color: 'var(--lp-text-primary)',
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '8px',
            marginTop: 0,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          }}
        >
          Join the waitlist
        </h2>
        <p
          style={{
            color: 'var(--lp-text-secondary)',
            fontSize: '14px',
            marginBottom: '24px',
            marginTop: 0,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          }}
        >
          Be first to know when CloudForge launches.
        </p>

        <WaitlistForm onSuccess={handleSuccess} />
      </div>
    </div>,
    document.body,
  );
}

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          zIndex: 100,
          background: scrolled ? 'rgba(13,15,19,0.9)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'var(--lp-border)' : 'transparent'}`,
          transition: 'background 200ms ease, border-color 200ms ease, backdrop-filter 200ms ease',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--lp-accent)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--lp-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            CloudForge
          </span>
        </div>

        {/* Center links — absolutely centered so they stay centered regardless of CTA width */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="lp-nav-link"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: 400,
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Right CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setOpen(true)}
            className="lp-btn-primary"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              padding: '7px 16px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            Join the waitlist →
          </button>
        </div>
      </nav>

      {open && <WaitlistModal onClose={handleClose} />}
    </>
  );
}
