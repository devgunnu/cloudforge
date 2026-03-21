'use client';

import { Terminal } from 'lucide-react';

export default function LivePage() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--lp-bg)',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'var(--lp-accent-dim)',
          border: '0.5px solid rgba(45,212,191,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Terminal size={22} style={{ color: 'var(--lp-accent)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            marginBottom: '6px',
          }}
        >
          Deployment monitoring
        </p>
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-text-secondary)',
          }}
        >
          Coming soon — live metrics, logs, and alerts for your deployed infrastructure.
        </p>
      </div>
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          background: 'var(--lp-elevated)',
          border: '0.5px solid var(--lp-border-hover)',
          borderRadius: '100px',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '11px',
          color: 'var(--lp-text-hint)',
          letterSpacing: '0.04em',
        }}
      >
        stub
      </span>
    </div>
  );
}
