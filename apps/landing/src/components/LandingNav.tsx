export default function LandingNav() {
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '52px',
      background: 'rgba(10,14,26,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid var(--cf-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      zIndex: 100,
      justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <span style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '15px',
        color: 'var(--cf-green)',
        fontWeight: 600,
      }}>
        CloudForge<span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
      </span>

      {/* Launch button */}
      <a
        href={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 14px',
          background: 'var(--cf-green-dim)',
          border: '0.5px solid var(--cf-green)',
          borderRadius: '7px',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '12px',
          color: 'var(--cf-green)',
          textDecoration: 'none',
          transition: 'background 150ms ease',
        }}
      >
        Launch Builder →
      </a>
    </nav>
  );
}
