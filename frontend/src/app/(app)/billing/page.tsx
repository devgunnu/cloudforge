'use client';

import { motion } from 'framer-motion';
import { Check, Download, Zap, Server, GitBranch, Hammer } from 'lucide-react';

// ── Static data ───────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending';
  period: string;
}

// Static placeholder — billing integration coming soon
const SAMPLE_INVOICES: Invoice[] = [
  { id: 'inv-2026-03', date: 'Mar 1, 2026', amount: '$49.00', status: 'paid', period: 'Mar 2026' },
  { id: 'inv-2026-02', date: 'Feb 1, 2026', amount: '$49.00', status: 'paid', period: 'Feb 2026' },
  { id: 'inv-2026-01', date: 'Jan 1, 2026', amount: '$49.00', status: 'paid', period: 'Jan 2026' },
];

const PLANS = [
  {
    id: 'hobby',
    name: 'Hobby',
    price: '$0',
    period: '/mo',
    features: ['5 projects', '10 builds / month', 'Community support'],
    current: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/mo',
    features: ['Unlimited projects', '50 builds / month', 'Priority support', 'API access', 'GitHub integration'],
    current: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$149',
    period: '/mo',
    features: ['Everything in Pro', 'Up to 10 seats', 'SSO / SAML', 'Audit logs', 'SLA guarantee'],
    current: false,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function UsageBar({
  label,
  icon,
  used,
  total,
  unit,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  total: number | null;
  unit: string;
}) {
  const pct = total ? Math.min((used / total) * 100, 100) : 0;
  const danger = pct >= 80;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--lp-text-primary)',
          }}
        >
          <span aria-hidden="true" style={{ color: 'var(--lp-text-secondary)' }}>{icon}</span>
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            color: danger ? '#f87171' : 'var(--lp-text-secondary)',
          }}
        >
          {used.toLocaleString()} {total ? `/ ${total.toLocaleString()}` : '∞'} {unit}
        </span>
      </div>
      {total && (
        <div
          style={{
            height: '4px',
            background: 'var(--lp-elevated)',
            borderRadius: '100px',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${label}: ${used} of ${total} ${unit} used`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%',
              borderRadius: '100px',
              background: danger ? '#f87171' : 'var(--lp-accent)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  index,
}: {
  plan: (typeof PLANS)[number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
      style={{
        background: plan.current ? 'var(--lp-elevated)' : 'var(--lp-surface)',
        border: `0.5px solid ${plan.current ? 'var(--lp-accent)' : 'var(--lp-border)'}`,
        borderRadius: '12px',
        padding: '20px',
        position: 'relative',
        flex: 1,
      }}
    >
      {plan.current && (
        <span
          style={{
            position: 'absolute',
            top: '-1px',
            right: '16px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--lp-bg)',
            background: 'var(--lp-accent)',
            borderRadius: '0 0 6px 6px',
            padding: '2px 8px',
          }}
          aria-label="Current plan"
        >
          CURRENT
        </span>
      )}

      <div
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          color: plan.current ? 'var(--lp-accent)' : 'var(--lp-text-primary)',
          marginBottom: '8px',
        }}
      >
        {plan.name}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '2px',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.03em',
          }}
        >
          {plan.price}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-text-secondary)',
          }}
        >
          {plan.period}
        </span>
      </div>

      <ul style={{ listStyle: 'none', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {plan.features.map((f) => (
          <li
            key={f}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            <Check size={11} aria-hidden="true" style={{ color: 'var(--lp-accent)', flexShrink: 0 }} />
            {f}
          </li>
        ))}
      </ul>

      {!plan.current && (
        <button
          type="button"
          style={{
            width: '100%',
            background: 'transparent',
            border: '0.5px solid var(--lp-border-hover)',
            borderRadius: '8px',
            padding: '8px 0',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--lp-text-secondary)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
          aria-label={`Upgrade to ${plan.name}`}
        >
          {plan.id === 'hobby' ? 'Downgrade' : 'Upgrade'}
        </button>
      )}

      {plan.current && (
        <div
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-text-hint)',
            textAlign: 'center',
          }}
        >
          Renews Apr 1, 2026
        </div>
      )}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        padding: '32px 40px',
        overflowY: 'auto',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--lp-text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '32px',
        }}
      >
        Billing
      </h1>

      {/* Plans */}
      <section style={{ marginBottom: '48px' }} aria-label="Subscription plans">
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lp-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          Plans
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>
      </section>

      {/* Usage */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        style={{
          background: 'var(--lp-surface)',
          border: '0.5px solid var(--lp-border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          maxWidth: '600px',
        }}
        aria-label="Usage this billing period"
      >
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lp-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}
        >
          Usage · Mar 2026
        </h2>
        <UsageBar label="Builds" icon={<Hammer size={13} />} used={23} total={50} unit="builds" />
        <UsageBar label="API calls" icon={<Zap size={13} />} used={12400} total={50000} unit="calls" />
        <UsageBar label="Deployments" icon={<Server size={13} />} used={8} total={null} unit="deploys" />
        <UsageBar label="Projects" icon={<GitBranch size={13} />} used={3} total={null} unit="active" />
      </motion.section>

      {/* Payment method */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.26 }}
        style={{ marginBottom: '32px', maxWidth: '600px' }}
        aria-label="Payment method"
      >
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lp-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          Payment method
        </h2>
        <div
          style={{
            background: 'var(--lp-surface)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Visa wordmark approximation */}
            <div
              aria-hidden="true"
              style={{
                width: '40px',
                height: '26px',
                background: 'var(--lp-elevated)',
                border: '0.5px solid var(--lp-border-hover)',
                borderRadius: '5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '10px',
                fontWeight: 800,
                color: '#2563eb',
                letterSpacing: '0.02em',
              }}
            >
              VISA
            </div>
            <div>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--lp-text-primary)',
                }}
              >
                Visa ending in 4242
              </span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  color: 'var(--lp-text-secondary)',
                }}
              >
                Expires 09 / 2028
              </span>
            </div>
          </div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: '0.5px solid var(--lp-border-hover)',
              borderRadius: '7px',
              padding: '5px 12px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
              cursor: 'pointer',
            }}
            aria-label="Update payment method"
          >
            Update
          </button>
        </div>
      </motion.section>

      {/* Invoice history */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
        style={{ maxWidth: '600px' }}
        aria-label="Invoice history"
      >
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lp-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          Invoices
        </h2>

        <div
          style={{
            background: 'var(--lp-surface)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 80px 40px',
              gap: '8px',
              padding: '10px 16px',
              borderBottom: '0.5px solid var(--lp-border)',
              background: 'var(--lp-elevated)',
            }}
            aria-hidden="true"
          >
            {['Period', 'Date', 'Amount', ''].map((h) => (
              <span
                key={h}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--lp-text-hint)',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {SAMPLE_INVOICES.map((inv, i) => (
            <div
              key={inv.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 80px 40px',
                gap: '8px',
                padding: '12px 16px',
                borderBottom: i < SAMPLE_INVOICES.length - 1 ? '0.5px solid var(--lp-border)' : 'none',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  color: 'var(--lp-text-primary)',
                  fontWeight: 500,
                }}
              >
                {inv.period}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  color: 'var(--lp-text-secondary)',
                }}
              >
                {inv.date}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: '12px',
                    color: 'var(--lp-text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {inv.amount}
                </span>
              </div>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--lp-text-hint)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '5px',
                  transition: 'color 120ms ease',
                }}
                aria-label={`Download invoice for ${inv.period}`}
              >
                <Download size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
