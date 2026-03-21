import Link from 'next/link';

export default function LandingNav() {
  return (
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
        background: 'rgba(13,15,19,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--lp-border)',
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

      {/* Nav links — centered absolutely so they stay centered regardless of CTA width */}
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
        {(['How it works', 'Features', 'Docs'] as const).map((label) => (
          <a
            key={label}
            href="#"
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

      {/* CTA */}
      <Link
        href="/dashboard"
        className="lp-btn-primary"
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          padding: '8px 18px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        Go to dashboard
        <span style={{ opacity: 0.6 }}>↗</span>
      </Link>
    </nav>
  );
}
