const TECH = [
  'Next.js',
  'React Flow',
  'Claude API',
  'AWS',
  'Terraform',
  'Tailwind',
];

export default function TechStack() {
  return (
    <section
      style={{
        padding: '48px 24px 96px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '11px',
          color: 'var(--cf-text-hint)',
          letterSpacing: '0.1em',
        }}
      >
        // BUILT WITH
      </span>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        {TECH.map((name) => (
          <div
            key={name}
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '12px',
              color: 'var(--cf-text-muted)',
              background: 'var(--cf-bg-elevated)',
              border: '0.5px solid var(--cf-border-hover)',
              borderRadius: '6px',
              padding: '6px 12px',
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </section>
  );
}
