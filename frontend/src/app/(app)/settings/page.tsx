'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Plug, Key, Trash2, Check, Github, RefreshCw } from 'lucide-react';

// ── Types & shared UI ─────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--lp-text-primary)',
        letterSpacing: '-0.01em',
        marginBottom: '16px',
      }}
    >
      {children}
    </h2>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        padding: '14px 0',
        borderBottom: '0.5px solid var(--lp-border)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--lp-text-primary)',
          }}
        >
          {label}
        </span>
        {description && (
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
              marginTop: '2px',
            }}
          >
            {description}
          </span>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'var(--lp-elevated)',
        border: '0.5px solid var(--lp-border-hover)',
        borderRadius: '7px',
        padding: '7px 10px',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '13px',
        color: readOnly ? 'var(--lp-text-secondary)' : 'var(--lp-text-primary)',
        outline: 'none',
        width: '200px',
        cursor: readOnly ? 'default' : 'text',
      }}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: '100px',
        background: checked ? 'var(--lp-accent)' : 'var(--lp-elevated)',
        border: `0.5px solid ${checked ? 'var(--lp-accent)' : 'var(--lp-border-hover)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 150ms ease, border-color 150ms ease',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '18px' : '2px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: checked ? 'var(--lp-bg)' : 'var(--lp-text-hint)',
          transition: 'left 150ms ease, background 150ms ease',
        }}
      />
    </button>
  );
}

function IntegrationCard({
  name,
  description,
  icon,
  connected,
  onToggle,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px',
        background: 'var(--lp-elevated)',
        border: '0.5px solid var(--lp-border)',
        borderRadius: '10px',
        marginBottom: '8px',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'var(--lp-surface)',
          border: '0.5px solid var(--lp-border-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--lp-text-secondary)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-text-secondary)',
          }}
        >
          {description}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: connected ? 'transparent' : 'var(--lp-accent-dim)',
          border: `0.5px solid ${connected ? 'var(--lp-border-hover)' : 'var(--lp-accent)'}`,
          borderRadius: '7px',
          padding: '5px 12px',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          color: connected ? 'var(--lp-text-secondary)' : 'var(--lp-accent)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 120ms ease',
          flexShrink: 0,
        }}
        aria-label={connected ? `Disconnect ${name}` : `Connect ${name}`}
      >
        {connected ? <><Check size={11} /> Connected</> : 'Connect'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // Profile
  const [name, setName] = useState('Gunbir Singh');
  const [email] = useState('gunbir@cloudforge.dev');
  const [org, setOrg] = useState('CloudForge Labs');
  const [timezone, setTimezone] = useState('UTC−5 (EST)');

  // Notifications
  const [notifBuild, setNotifBuild] = useState(true);
  const [notifDeploy, setNotifDeploy] = useState(true);
  const [notifBilling, setNotifBilling] = useState(false);
  const [notifError, setNotifError] = useState(true);

  // Integrations
  const [githubConn, setGithubConn] = useState(true);
  const [slackConn, setSlackConn] = useState(false);
  const [awsConn, setAwsConn] = useState(true);

  // API key visibility
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const API_KEY = 'cfk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const MASKED_KEY = 'cfk_live_••••••••••••••••••••••••••••••••';

  // Save state
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const sections = [
    { id: 'profile', label: 'Profile', icon: <User size={14} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
    { id: 'integrations', label: 'Integrations', icon: <Plug size={14} /> },
    { id: 'api', label: 'API Keys', icon: <Key size={14} /> },
    { id: 'danger', label: 'Danger zone', icon: <Trash2 size={14} /> },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        display: 'flex',
        overflowY: 'auto',
      }}
    >
      {/* Settings nav */}
      <nav
        aria-label="Settings sections"
        style={{
          width: '192px',
          minWidth: '192px',
          padding: '32px 16px',
          borderRight: '0.5px solid var(--lp-border)',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--lp-text-hint)',
            marginBottom: '12px',
            paddingLeft: '8px',
          }}
        >
          Settings
        </p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '32px',
                  paddingLeft: '8px',
                  borderRadius: '7px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--lp-text-secondary)',
                  textDecoration: 'none',
                }}
              >
                <span aria-hidden="true">{s.icon}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: '660px' }}>
        {/* Profile */}
        <motion.section
          id="profile"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '48px' }}
        >
          <SectionHeader>Profile</SectionHeader>
          <SettingRow label="Full name" description="Displayed across your workspace">
            <TextInput value={name} onChange={setName} />
          </SettingRow>
          <SettingRow label="Email" description="Used for billing and notifications">
            <TextInput value={email} readOnly />
          </SettingRow>
          <SettingRow label="Organisation" description="Your team or company name">
            <TextInput value={org} onChange={setOrg} />
          </SettingRow>
          <SettingRow label="Timezone">
            <TextInput value={timezone} onChange={setTimezone} />
          </SettingRow>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="lp-btn-primary"
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
              }}
            >
              {saved ? <><Check size={13} /> Saved</> : 'Save changes'}
            </button>
          </div>
        </motion.section>

        {/* Notifications */}
        <motion.section
          id="notifications"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
          style={{ marginBottom: '48px' }}
        >
          <SectionHeader>Notifications</SectionHeader>
          <SettingRow label="Build notifications" description="Email when a build completes or fails">
            <Toggle checked={notifBuild} onChange={setNotifBuild} />
          </SettingRow>
          <SettingRow label="Deploy alerts" description="Email on every successful deployment">
            <Toggle checked={notifDeploy} onChange={setNotifDeploy} />
          </SettingRow>
          <SettingRow label="Error alerts" description="Immediate email on deploy or build failure">
            <Toggle checked={notifError} onChange={setNotifError} />
          </SettingRow>
          <SettingRow label="Billing reminders" description="Upcoming renewal and invoice emails">
            <Toggle checked={notifBilling} onChange={setNotifBilling} />
          </SettingRow>
        </motion.section>

        {/* Integrations */}
        <motion.section
          id="integrations"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{ marginBottom: '48px' }}
        >
          <SectionHeader>Integrations</SectionHeader>
          <IntegrationCard
            name="GitHub"
            description="Link repos and trigger builds on push"
            icon={<Github size={15} />}
            connected={githubConn}
            onToggle={() => setGithubConn((v) => !v)}
          />
          <IntegrationCard
            name="Slack"
            description="Receive build and deploy alerts in Slack"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="currentColor"/>
              </svg>
            }
            connected={slackConn}
            onToggle={() => setSlackConn((v) => !v)}
          />
          <IntegrationCard
            name="AWS"
            description="Deploy directly to your AWS account"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.064.056.128.056.184 0 .08-.048.16-.152.24l-.504.336a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.24-.112a2.47 2.47 0 0 1-.288-.376 6.18 6.18 0 0 1-.248-.472c-.624.736-1.408 1.104-2.352 1.104-.672 0-1.208-.192-1.6-.576-.392-.384-.592-.896-.592-1.536 0-.68.24-1.232.728-1.648.488-.416 1.136-.624 1.96-.624.272 0 .552.024.848.064.296.04.6.104.92.176v-.584c0-.608-.128-1.032-.376-1.28-.256-.248-.688-.368-1.304-.368-.28 0-.568.032-.864.104-.296.072-.584.16-.864.272a2.294 2.294 0 0 1-.28.104.488.488 0 0 1-.128.024c-.112 0-.168-.08-.168-.248v-.392c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.168c.28-.144.616-.264 1.008-.36a4.86 4.86 0 0 1 1.248-.144c.952 0 1.648.216 2.096.648.44.432.664 1.088.664 1.968v2.592zm-3.24 1.212c.264 0 .536-.048.824-.144.288-.096.544-.272.76-.512.128-.152.224-.32.272-.512.048-.192.08-.424.08-.696v-.336a6.69 6.69 0 0 0-.736-.136 6.03 6.03 0 0 0-.752-.048c-.536 0-.928.104-1.192.32-.264.216-.392.52-.392.92 0 .376.096.656.296.848.192.2.472.296.84.296zm6.44.876c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.312L7.62 6.472a1.404 1.404 0 0 1-.072-.32c0-.128.064-.2.192-.2h.784c.152 0 .256.024.312.08.064.048.112.16.16.312l1.416 5.576 1.312-5.576c.04-.16.088-.264.152-.312a.533.533 0 0 1 .32-.08h.64c.152 0 .256.024.32.08.064.048.12.16.152.312l1.328 5.648 1.46-5.648c.048-.16.104-.264.16-.312a.533.533 0 0 1 .312-.08h.744c.128 0 .2.064.2.2 0 .04-.008.08-.016.128a1.137 1.137 0 0 1-.056.2l-2.056 5.76c-.048.16-.104.264-.168.312-.064.048-.168.08-.304.08h-.688c-.152 0-.256-.024-.32-.08-.064-.056-.12-.16-.152-.32L12.96 7.648l-1.304 5.424c-.04.16-.088.264-.152.32-.064.056-.176.08-.32.08h-.688zm10.943.144c-.416 0-.832-.048-1.232-.144-.4-.096-.712-.2-.92-.32-.128-.072-.216-.152-.248-.224a.56.56 0 0 1-.048-.224v-.408c0-.168.064-.248.184-.248.048 0 .096.008.144.024.048.016.12.048.2.08.272.12.568.216.888.28.328.064.648.096.976.096.52 0 .92-.088 1.2-.264a.863.863 0 0 0 .42-.772.785.785 0 0 0-.212-.556c-.144-.152-.416-.288-.816-.416l-1.168-.36c-.592-.184-1.032-.456-1.304-.816a1.93 1.93 0 0 1-.408-1.192c0-.344.072-.648.216-.912.144-.264.336-.496.576-.688.24-.2.512-.344.824-.448.312-.104.64-.152.984-.152.168 0 .344.008.512.032.176.024.336.056.488.088.144.04.28.08.408.128.128.048.224.096.296.144a.62.62 0 0 1 .208.168.364.364 0 0 1 .056.216v.376c0 .168-.064.256-.184.256a.83.83 0 0 1-.304-.096 3.652 3.652 0 0 0-1.544-.32c-.472 0-.84.072-1.096.224-.256.152-.384.384-.384.704 0 .216.08.4.232.552.152.152.44.304.864.44l1.144.36c.584.184 1.008.44 1.272.768.264.328.392.704.392 1.12 0 .352-.072.672-.208.952-.144.28-.336.528-.584.728-.248.208-.544.36-.888.464-.36.112-.744.168-1.16.168z" fill="currentColor"/>
              </svg>
            }
            connected={awsConn}
            onToggle={() => setAwsConn((v) => !v)}
          />
        </motion.section>

        {/* API Keys */}
        <motion.section
          id="api"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
          style={{ marginBottom: '48px' }}
        >
          <SectionHeader>API Keys</SectionHeader>
          <div
            style={{
              background: 'var(--lp-elevated)',
              border: '0.5px solid var(--lp-border)',
              borderRadius: '10px',
              padding: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--lp-text-primary)',
                }}
              >
                Production key
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '11px',
                  color: '#34d399',
                  background: 'rgba(52,211,153,0.1)',
                  border: '0.5px solid rgba(52,211,153,0.2)',
                  borderRadius: '100px',
                  padding: '2px 8px',
                  fontWeight: 500,
                }}
              >
                Active
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <code
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '12px',
                  color: 'var(--lp-text-secondary)',
                  background: 'var(--lp-surface)',
                  border: '0.5px solid var(--lp-border)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {apiKeyVisible ? API_KEY : MASKED_KEY}
              </code>
              <button
                type="button"
                onClick={() => setApiKeyVisible((v) => !v)}
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--lp-border-hover)',
                  borderRadius: '7px',
                  padding: '6px 10px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  color: 'var(--lp-text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                aria-label={apiKeyVisible ? 'Hide API key' : 'Reveal API key'}
              >
                {apiKeyVisible ? 'Hide' : 'Reveal'}
              </button>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--lp-border-hover)',
                  borderRadius: '7px',
                  padding: '6px',
                  color: 'var(--lp-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Rotate API key"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '11px',
                color: 'var(--lp-text-hint)',
                marginTop: '10px',
              }}
            >
              Created Mar 1, 2026 · Never expires
            </p>
          </div>
        </motion.section>

        {/* Danger zone */}
        <motion.section
          id="danger"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
          style={{ marginBottom: '48px' }}
        >
          <SectionHeader>Danger zone</SectionHeader>
          <div
            style={{
              border: '0.5px solid rgba(248,113,113,0.25)',
              borderRadius: '10px',
              padding: '16px',
              background: 'rgba(248,113,113,0.04)',
            }}
          >
            <SettingRow
              label="Delete account"
              description="Permanently delete your account and all projects. This cannot be undone."
            >
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: '0.5px solid rgba(248,113,113,0.4)',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#f87171',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                aria-label="Delete account permanently"
              >
                <Trash2 size={12} aria-hidden="true" />
                Delete account
              </button>
            </SettingRow>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
