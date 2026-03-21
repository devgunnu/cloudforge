'use client';

import { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface CenterInputBarProps {
  placeholder: string;
  onSend?: (value: string) => void;
}

export default function CenterInputBar({ placeholder, onSend }: CenterInputBarProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const containerBorder = focused
    ? 'var(--lp-accent)'
    : 'var(--lp-border-hover)';

  const containerShadow = focused
    ? '0 0 0 1px var(--lp-accent-dim), 0 8px 32px var(--cf-bg-base)'
    : '0 0 0 1px var(--lp-border), 0 8px 32px var(--cf-bg-base)';

  return (
    <div
      style={{
        position: 'sticky',
        bottom: '24px',
        left: 0,
        right: 0,
        zIndex: 40,
        margin: '0 auto',
        maxWidth: '680px',
        width: '60%',
        minWidth: '400px',
      }}
    >
      <div
        style={{
          background: 'var(--lp-surface)',
          border: `0.5px solid ${containerBorder}`,
          borderRadius: '14px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: containerShadow,
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          aria-label="Chat input"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            flex: 1,
            resize: 'none',
            minHeight: '20px',
            maxHeight: '120px',
            fontSize: '14px',
            color: 'var(--lp-text-primary)',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleSend}
          aria-label="Send message"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--lp-accent-dim)',
            border: '0.5px solid var(--lp-border-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--lp-accent-glow)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--lp-accent-dim)';
          }}
        >
          <ArrowUp size={15} style={{ color: 'var(--lp-accent)' }} aria-hidden />
        </button>
      </div>

      {/* Placeholder text color override via injected style tag */}
      <style>{`
        textarea::placeholder {
          color: var(--lp-text-hint);
        }
      `}</style>
    </div>
  );
}
