const ITEMS = [
  'End-to-end pipeline',
  'Graph-validated architecture',
  'Deploys to your AWS, not ours',
  '10+ AWS services',
  'Open source',
] as const;

export default function SocialProof() {
  return (
    <div
      style={{
        borderTop: '1px solid var(--lp-border)',
        borderBottom: '1px solid var(--lp-border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0',
        flexWrap: 'wrap',
        background: 'var(--lp-bg)',
      }}
    >
      {ITEMS.map((item, i) => (
        <span key={item} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--lp-text-secondary)',
              padding: '4px 16px',
              whiteSpace: 'nowrap',
            }}
          >
            {item}
          </span>
          {i < ITEMS.length - 1 && (
            <span style={{ color: 'var(--lp-text-hint)', fontSize: '13px' }}>·</span>
          )}
        </span>
      ))}
    </div>
  );
}
