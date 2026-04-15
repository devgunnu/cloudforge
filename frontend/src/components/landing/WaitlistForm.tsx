'use client';

import { useState } from 'react';

interface WaitlistFormProps {
  className?: string;
}

type FormState = 'idle' | 'loading' | 'success' | 'error';

export default function WaitlistForm({ className }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function isValidEmail(value: string): boolean {
    // RFC 5322-inspired regex: validates local-part and domain structure.
    // Not a replacement for server-side validation — purely a UX gate.
    const RFC_EMAIL_RE =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return RFC_EMAIL_RE.test(value.trim());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setState('loading');
    setErrorMessage('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setState('success');
        return;
      }

      // 422 = Pydantic validation error (disposable domain, bad MX, etc.)
      if (res.status === 422) {
        const data = (await res.json()) as {
          detail?: Array<{ msg: string }> | string;
        };
        const first =
          Array.isArray(data.detail) && data.detail[0]?.msg
            ? data.detail[0].msg.replace(/^Value error, /i, '')
            : 'Please enter a valid email address.';
        setErrorMessage(first);
        setState('error');
        return;
      }

      // 429 = rate limit exceeded
      if (res.status === 429) {
        setErrorMessage('Too many attempts. Please wait a minute and try again.');
        setState('error');
        return;
      }

      const data = (await res.json()) as { message?: string };
      if (data.message === 'already_registered') {
        setErrorMessage('Already on the waitlist.');
      } else {
        setErrorMessage('Something went wrong. Try again.');
      }
      setState('error');
    } catch {
      setErrorMessage('Something went wrong. Try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div
        className={className}
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--lp-accent)',
        }}
      >
        You&apos;re on the list.
      </div>
    );
  }

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ display: 'flex', gap: '0', maxWidth: '480px' }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMessage) setErrorMessage('');
          }}
          placeholder="you@company.com"
          aria-label="Email address"
          disabled={state === 'loading'}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            background: '#0f1a16',
            border: '1px solid var(--lp-border)',
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '12px 16px',
            width: '280px',
            color: 'var(--lp-text-primary)',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--lp-accent)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--lp-border)';
          }}
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="lp-btn-primary"
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 500,
            padding: '12px 20px',
            borderRadius: '0 8px 8px 0',
            cursor: state === 'loading' ? 'not-allowed' : 'pointer',
            opacity: state === 'loading' ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {state === 'loading' ? 'Joining...' : 'Join waitlist \u2192'}
        </button>
      </form>

      {errorMessage && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: '#f87171',
            marginTop: '8px',
          }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
