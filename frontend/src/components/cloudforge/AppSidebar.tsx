'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FolderOpen, Clock, Settings, CreditCard, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';


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
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = useAuthStore((state) => state.logout);

  function handleSignOut() {
    logout();
    router.push('/login');
  }

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
  }, []);
  const [toggleHovered, setToggleHovered] = useState(false);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  return (
    <aside
      style={{
        width: collapsed ? '52px' : '220px',
        minWidth: collapsed ? '52px' : '220px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 8px',
        background: 'var(--lp-surface)',
        borderRight: '0.5px solid var(--lp-border)',
        flexShrink: 0,
        transition: 'width 200ms ease, min-width 200ms ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo row — logo left, collapse toggle right */}
      <div
        style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          marginBottom: '24px',
          flexShrink: 0,
          gap: '4px',
        }}
      >
        {/* Logo link — hidden when collapsed */}
        {!collapsed && <Link
          href="/dashboard"
          aria-label="CloudForge — go to dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            paddingLeft: '4px',
            minWidth: 0,
            flex: 1,
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
              flexShrink: 0,
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
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            CloudForge
          </span>
        </Link>}

        {/* Collapse / expand toggle — always visible in logo row */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onMouseEnter={() => setToggleHovered(true)}
          onMouseLeave={() => setToggleHovered(false)}
          style={{
            flexShrink: 0,
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: `0.5px solid ${toggleHovered ? 'var(--lp-border-hover)' : 'var(--lp-border)'}`,
            background: toggleHovered ? 'var(--lp-elevated)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: toggleHovered ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
            transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
            padding: 0,
          }}
        >
          {collapsed
            ? <ChevronRight size={13} aria-hidden="true" />
            : <ChevronLeft size={13} aria-hidden="true" />}
        </button>
      </div>

      {/* Nav links */}
      <nav aria-label="Main navigation" className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <ul
          style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: 0,
            margin: 0,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <NavLink item={item} isActive={isActive} collapsed={collapsed} />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User row */}
      <div style={{ position: 'relative' }}>
        {menuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '4px',
              background: 'var(--lp-elevated)',
              border: '0.5px solid var(--lp-border-hover)',
              borderRadius: '10px',
              padding: '4px',
              minWidth: '160px',
              zIndex: 50,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 8px',
                borderRadius: '7px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: '#f87171',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--lp-surface)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <LogOut size={13} aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
        <button
          type="button"
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          onBlur={() => {
            setTimeout(() => setMenuOpen(false), 150);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '8px',
              padding: '8px 4px',
            }}
          >
            <div
              aria-label="User avatar"
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
                opacity: collapsed ? 0 : 1,
                maxWidth: collapsed ? 0 : '100px',
                transition: 'opacity 150ms ease, max-width 200ms ease',
              }}
            >
              Gunbir S.
            </span>
            {!collapsed && (
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
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        height: '32px',
        paddingLeft: collapsed ? '0' : '8px',
        paddingRight: collapsed ? '0' : '10px',
        borderRadius: '7px',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        textDecoration: 'none',
        gap: '8px',
        transition: 'background 120ms ease, color 120ms ease',
        color: isActive || hovered ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
        background: isActive || hovered ? 'var(--lp-elevated)' : 'transparent',
        borderLeft: !collapsed && isActive ? '2px solid var(--lp-accent)' : '2px solid transparent',
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
      <span
        style={{
          opacity: collapsed ? 0 : 1,
          maxWidth: collapsed ? 0 : '160px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: 'opacity 150ms ease, max-width 200ms ease',
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}
