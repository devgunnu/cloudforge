import type { ProjectStatus } from '@/lib/mock-data';

interface StatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'default';
}

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  deployed: {
    label: 'Deployed',
    bg: 'var(--lp-accent-dim)',
    color: 'var(--lp-accent)',
    border: 'var(--lp-border-hover)',
  },
  building: {
    label: 'Building',
    bg: 'var(--cf-purple-dim)',
    color: 'var(--cf-purple)',
    border: 'var(--cf-purple-border)',
  },
  draft: {
    label: 'Draft',
    bg: 'var(--lp-border)',
    color: 'var(--lp-text-hint)',
    border: 'var(--lp-border-hover)',
  },
};

export default function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const fontSize = size === 'sm' ? '10px' : '11px';
  const padding = size === 'sm' ? '1px 6px' : '2px 8px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        borderRadius: '100px',
        border: `0.5px solid ${config.border}`,
        background: config.bg,
        color: config.color,
        fontSize,
        fontWeight: 500,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {status === 'building' ? (
        <span
          aria-hidden="true"
          className="animate-pulse"
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--cf-purple)',
            flexShrink: 0,
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: config.color,
            flexShrink: 0,
          }}
        />
      )}
      {config.label}
    </span>
  );
}
