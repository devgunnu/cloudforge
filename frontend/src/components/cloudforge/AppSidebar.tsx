'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Clock, Settings, CreditCard } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Projects', href: '/dashboard', icon: <FolderOpen size={14} /> },
  { label: 'History', href: '/history', icon: <Clock size={14} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={14} /> },
  { label: 'Billing', href: '/billing', icon: <CreditCard size={14} /> },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: '220px',
        minWidth: '220px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        background: 'var(--lp-surface)',
        borderRight: '0.5px solid var(--lp-border)',
        flexShrink: 0,
      }}
    >
      {/* Logo zone */}
      <div
        style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--lp-accent)',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ◈
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--lp-text-primary)',
          }}
        >
          CloudForge
        </span>
      </div>

      {/* Nav links */}
      <nav aria-label="Main navigation">
        <ul
          style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {NAV_ITEMS.map((item) => {
            // startsWith(item.href + '/') is safe here: none of the hrefs
            // (/dashboard, /history, /settings, /billing) is a prefix of another,
            // so there are no false-positive matches from the prefix check.
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <NavLink item={item} isActive={isActive} />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} aria-hidden="true" />

      {/* User row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 4px',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--lp-elevated)',
            border: '0.5px solid var(--lp-border-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--lp-text-secondary)',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          }}
        >
          GS
        </div>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--lp-text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Gunbir S.
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: 'var(--lp-accent)',
            background: 'var(--lp-accent-dim)',
            border: '0.5px solid var(--lp-border-hover)',
            borderRadius: '100px',
            padding: '1px 6px',
            flexShrink: 0,
          }}
        >
          Pro
        </span>
      </div>
    </aside>
  );
}

// Extracted sub-component so useState can manage hover without prop drilling
function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);

  const bgColor = isActive
    ? 'var(--lp-elevated)'
    : hovered
      ? 'var(--lp-elevated)'
      : 'transparent';

  const textColor = isActive || hovered ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)';

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        paddingLeft: '8px',
        paddingRight: '10px',
        borderRadius: '7px',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        textDecoration: 'none',
        gap: '8px',
        transition: 'background 120ms ease, color 120ms ease',
        color: textColor,
        background: bgColor,
        borderLeft: isActive ? '2px solid var(--lp-accent)' : '2px solid transparent',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: isActive ? 'var(--lp-accent)' : 'currentColor',
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}
