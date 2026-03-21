'use client';

import { CheckCircle2, Lock } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  state: 'done' | 'active' | 'locked';
}

interface TabBarProps {
  tabs: Tab[];
  onTabClick?: (tabId: string) => void;
  className?: string;
}

export default function TabBar({ tabs, onTabClick, className }: TabBarProps) {
  return (
    <nav
      className={className}
      style={{
        height: '44px',
        borderBottom: '0.5px solid var(--lp-border)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 24px',
        background: 'var(--lp-bg)',
        gap: '4px',
        flexShrink: 0,
      }}
      aria-label="Project tabs"
    >
      {tabs.map((tab) => (
        <TabItem key={tab.id} tab={tab} onTabClick={onTabClick} />
      ))}
    </nav>
  );
}

function TabItem({ tab, onTabClick }: { tab: Tab; onTabClick?: (id: string) => void }) {
  const isLocked = tab.state === 'locked';

  const baseStyle: React.CSSProperties = {
    padding: '0 14px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    position: 'relative',
    cursor: isLocked ? 'not-allowed' : (tab.state === 'done' && onTabClick) ? 'pointer' : 'default',
    userSelect: 'none',
    background: 'transparent',
    border: 'none',
    outline: 'none',
  };

  const stateStyle: React.CSSProperties =
    tab.state === 'done'
      ? { color: 'var(--lp-text-secondary)' }
      : tab.state === 'active'
        ? { color: 'var(--lp-text-primary)', fontWeight: 500 }
        : { color: 'var(--lp-text-hint)' };

  return (
    <button
      style={{ ...baseStyle, ...stateStyle }}
      disabled={isLocked}
      aria-current={tab.state === 'active' ? 'page' : undefined}
      aria-disabled={isLocked}
      aria-label={isLocked ? `${tab.label} — locked, complete previous steps to unlock` : undefined}
      tabIndex={isLocked ? -1 : 0}
      onClick={tab.state === 'done' && onTabClick ? () => onTabClick(tab.id) : undefined}
    >
      {tab.state === 'done' && (
        <CheckCircle2
          size={13}
          style={{ color: 'var(--lp-accent)', flexShrink: 0 }}
          aria-hidden
        />
      )}

      <span>{tab.label}</span>

      {tab.state === 'locked' && (
        <Lock
          size={12}
          style={{ color: 'var(--lp-text-hint)', flexShrink: 0 }}
          aria-hidden
        />
      )}

      {tab.state === 'active' && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1.5px',
            background: 'var(--lp-accent)',
          }}
        />
      )}
    </button>
  );
}
