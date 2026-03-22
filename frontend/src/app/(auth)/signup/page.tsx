'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Sub-components ────────────────────────────────────────────────────────────

function FormInput({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  children,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  children?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '14px' }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--lp-text-secondary)',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            background: 'var(--lp-elevated)',
            border: `0.5px solid ${focused ? 'var(--lp-accent)' : 'var(--lp-border-hover)'}`,
            borderRadius: '9px',
            padding: children ? '10px 40px 10px 12px' : '10px 12px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '14px',
            color: 'var(--lp-text-primary)',
            outline: 'none',
            transition: 'border-color 120ms ease',
            boxSizing: 'border-box',
          }}
        />
        {children && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--lp-text-hint)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : 3;

  const labels = ['', 'Weak', 'Fair', 'Strong'];
  const colors = ['', '#f87171', '#f59e0b', '#34d399'];

  if (!password) return null;

  return (
    <div
      style={{
        marginTop: '-6px',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
      aria-live="polite"
      aria-label={`Password strength: ${labels[strength]}`}
    >
      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              flex: 1,
              height: '3px',
              borderRadius: '100px',
              background: i <= strength ? colors[strength] : 'var(--lp-elevated)',
              transition: 'background 200ms ease',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          color: colors[strength],
          fontWeight: 500,
          minWidth: '36px',
        }}
      >
        {labels[strength]}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, email, password }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError((body as { detail?: string }).detail || 'Registration failed. Please try again.');
        return;
      }
      const data = await resp.json();
      setAuth(data.access_token, data.refresh_token, data.user);
      router.push('/dashboard');
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%', maxWidth: '400px' }}
    >
      {/* Brand mark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
          justifyContent: 'center',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--lp-accent)',
            lineHeight: 1,
          }}
        >
          ◈
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--lp-text-primary)',
          }}
        >
          CloudForge
        </span>
      </div>

      {/* Card */}
      <div
        style={{
          background: 'var(--lp-surface)',
          border: '0.5px solid var(--lp-border)',
          borderRadius: '16px',
          padding: '28px 28px 24px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '4px',
          }}
        >
          Create your account
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-text-secondary)',
            marginBottom: '24px',
          }}
        >
          Start building infrastructure in minutes
        </p>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              marginBottom: '14px',
              padding: '9px 12px',
              background: 'rgba(248,113,113,0.08)',
              border: '0.5px solid rgba(248,113,113,0.3)',
              borderRadius: '8px',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <FormInput
            id="name"
            label="Full name"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Ada Lovelace"
            autoComplete="name"
          />
          <FormInput
            id="email"
            label="Work email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="ada@example.com"
            autoComplete="email"
          />
          <FormInput
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="Min 8 characters"
            autoComplete="new-password"
          >
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                padding: 0,
                display: 'flex',
              }}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </FormInput>

          <PasswordStrength password={password} />

          {/* Agree checkbox */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={agreed}
              onClick={() => setAgreed((v) => !v)}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: `0.5px solid ${agreed ? 'var(--lp-accent)' : 'var(--lp-border-hover)'}`,
                background: agreed ? 'var(--lp-accent)' : 'var(--lp-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                marginTop: '1px',
                transition: 'all 120ms ease',
                padding: 0,
              }}
              aria-label="Agree to terms"
            >
              {agreed && <Check size={10} aria-hidden="true" style={{ color: 'var(--lp-bg)' }} />}
            </button>
            <span
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                color: 'var(--lp-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              I agree to the{' '}
              <Link href="#" style={{ color: 'var(--lp-accent)', textDecoration: 'none' }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="#" style={{ color: 'var(--lp-accent)', textDecoration: 'none' }}>
                Privacy Policy
              </Link>
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="lp-btn-primary"
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '11px 0',
              borderRadius: '9px',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 120ms ease',
            }}
            aria-busy={loading}
          >
            {loading ? (
              'Creating account…'
            ) : (
              <>
                Create account
                <ArrowRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '13px',
          color: 'var(--lp-text-secondary)',
          textAlign: 'center',
          marginTop: '20px',
        }}
      >
        Already have an account?{' '}
        <Link
          href="/login"
          style={{
            color: 'var(--lp-accent)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Sign in
        </Link>
      </p>

    </motion.div>
  );
}
