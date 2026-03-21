'use client';

import { motion } from 'framer-motion';

interface ToggleGroupProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function ToggleGroup({ options, value, onChange }: ToggleGroupProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--lp-elevated)',
        borderRadius: '8px',
        padding: '3px',
        border: '0.5px solid var(--lp-border)',
      }}
      role="radiogroup"
      aria-label="Toggle view"
    >
      {options.map((option) => {
        const isActive = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option)}
            style={{
              position: 'relative',
              padding: '5px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--lp-text-primary)' : 'var(--lp-text-hint)',
              zIndex: 1,
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              transition: 'color 150ms ease',
            }}
          >
            {isActive && (
              <motion.span
                layoutId="toggle-active"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '6px',
                  background: 'var(--lp-surface)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {option}
          </button>
        );
      })}
    </div>
  );
}
