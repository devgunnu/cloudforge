'use client';

interface PlanCardProps {
  functional: string[];
  features: string[];
}

export default function PlanCard({ functional, features }: PlanCardProps) {
  return (
    <div
      style={{
        marginTop: '12px',
        background: 'var(--cf-bg-base)',
        border: '0.5px solid var(--lp-border-hover)',
        borderRadius: '10px',
        padding: '14px 16px',
        overflow: 'hidden',
      }}
    >
      {/* Functional Requirements */}
      <SectionLabel>Functional requirements</SectionLabel>
      <ul style={{ listStyle: 'none', marginBottom: '12px' }}>
        {functional.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '4px',
            }}
          >
            <Tag variant="fr">[FR]</Tag>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--lp-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>

      {/* Divider */}
      <div
        style={{
          height: '0.5px',
          background: 'var(--lp-border)',
          marginBottom: '12px',
        }}
        aria-hidden
      />

      {/* Product Features */}
      <SectionLabel>Product features</SectionLabel>
      <ul style={{ listStyle: 'none' }}>
        {features.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '4px',
            }}
          >
            <Tag variant="feat">[Feat]</Tag>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--lp-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: 'var(--lp-text-hint)',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}
    >
      {children}
    </p>
  );
}

function Tag({ variant, children }: { variant: 'fr' | 'feat'; children: React.ReactNode }) {
  const isFr = variant === 'fr';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 600,
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        flexShrink: 0,
        marginTop: '1px',
        background: isFr ? 'var(--lp-accent-dim)' : 'var(--cf-purple-dim)',
        color: isFr ? 'var(--lp-accent)' : 'var(--cf-purple)',
      }}
    >
      {children}
    </span>
  );
}
