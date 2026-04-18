'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Github, Eye, EyeOff, ArrowRight } from 'lucide-react';

// ── Sub-components ────────────────────────────────────────────────────────────

function OAuthButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: hovered ? 'var(--lp-elevated)' : 'var(--lp-surface)',
        border: `0.5px solid ${hovered ? 'var(--lp-border-hover)' : 'var(--lp-border)'}`,
        borderRadius: '9px',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lp-text-primary)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
      aria-label={`Continue with ${label}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '20px 0',
      }}
      aria-hidden="true"
    >
      <div style={{ flex: 1, height: '0.5px', background: 'var(--lp-border)' }} />
      <span
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          color: 'var(--lp-text-hint)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        or
      </span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--lp-border)' }} />
    </div>
  );
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Mock: redirect to dashboard after short delay
    setTimeout(() => {
      router.push('/dashboard');
    }, 800);
  }

  function handleOAuth() {
    setLoading(true);
    // Redirect to backend GitHub OAuth login
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    window.location.href = `${apiUrl}/auth/github/login`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%', maxWidth: '380px' }}
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
          Welcome back
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-text-secondary)',
            marginBottom: '24px',
          }}
        >
          Sign in to your CloudForge account
        </p>

        {/* OAuth */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <OAuthButton
            icon={<Github size={15} aria-hidden="true" />}
            label="GitHub"
            onClick={handleOAuth}
          />
        </div>

        <Divider />

        {/* Email form */}
        <form onSubmit={handleSubmit} noValidate>
          <FormInput
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <FormInput
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
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

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '-4px',
              marginBottom: '20px',
            }}
          >
            <Link
              href="#"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                color: 'var(--lp-accent)',
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </Link>
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
              'Signing in…'
            ) : (
              <>
                Sign in
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
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          style={{
            color: 'var(--lp-accent)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Sign up
        </Link>
      </p>

      {/* Terms note */}
      <p
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          color: 'var(--lp-text-hint)',
          textAlign: 'center',
          marginTop: '12px',
          lineHeight: 1.5,
        }}
      >
        By continuing, you agree to our{' '}
        <Link href="#" style={{ color: 'var(--lp-text-secondary)', textDecoration: 'underline' }}>
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="#" style={{ color: 'var(--lp-text-secondary)', textDecoration: 'underline' }}>
          Privacy Policy
        </Link>
        .
      </p>

    </motion.div>
  );
}
