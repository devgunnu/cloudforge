import TerminalAnimation from './TerminalAnimation';

export default function Hero() {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        gap: '64px',
      }}
    >
      {/* Left: content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            background: 'var(--cf-bg-elevated)',
            border: '0.5px solid var(--cf-border-hover)',
            borderRadius: '100px',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: 'var(--cf-text-muted)',
            marginBottom: '24px',
          }}
        >
          Powered by Claude + AWS Cloud Control API
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 600,
            color: 'var(--cf-text-primary)',
            lineHeight: 1.1,
            marginBottom: '20px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          }}
        >
          Deploy AWS infrastructure{' '}
          <br />
          by{' '}
          <span style={{ color: 'var(--cf-green)' }}>drawing</span>
          {' '}it
        </h1>

        {/* Sub */}
        <p
          style={{
            fontSize: '18px',
            color: 'var(--cf-text-muted)',
            maxWidth: '540px',
            lineHeight: 1.6,
            marginBottom: '32px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          }}
        >
          Drag. Connect. Deploy. CloudForge turns your architecture diagram
          into real Terraform — powered by Claude AI.
        </p>

        {/* CTA row */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <a
            href={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 20px',
              background: 'var(--cf-green-dim)',
              border: '0.5px solid var(--cf-green)',
              borderRadius: '8px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '14px',
              color: 'var(--cf-green)',
              textDecoration: 'none',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,135,0.20)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--cf-green-dim)';
            }}
          >
            Launch Builder →
          </a>
          <a
            href="https://github.com"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 20px',
              background: 'transparent',
              border: '0.5px solid var(--cf-border-hover)',
              borderRadius: '8px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '14px',
              color: 'var(--cf-text-muted)',
              textDecoration: 'none',
              transition: 'color 150ms ease, border-color 150ms ease',
            }}
          >
            View on GitHub
          </a>
        </div>
      </div>

      {/* Right: terminal animation */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TerminalAnimation />
      </div>
    </section>
  );
}
