'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LogLine {
  id: string;
  timestamp: string;
  agent: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'main';
}

interface LogStreamProps {
  lines: LogLine[];
}

type BadgeStyle = {
  background: string;
  color: string;
  border: string;
};

function getBadgeStyle(level: LogLine['level']): BadgeStyle {
  switch (level) {
    case 'main':
      return {
        background: 'var(--lp-accent-dim)',
        color: 'var(--lp-accent)',
        border: '0.5px solid var(--lp-border-hover)',
      };
    case 'warn':
      return {
        background: 'var(--cf-amber-dim)',
        color: 'var(--cf-amber)',
        border: '0.5px solid rgba(255,179,0,0.2)',
      };
    case 'error':
      return {
        background: 'rgba(255,77,77,0.12)',
        color: 'var(--cf-red)',
        border: '0.5px solid rgba(255,77,77,0.2)',
      };
    case 'info':
    default:
      return {
        background: 'var(--cf-purple-dim)',
        color: 'var(--cf-purple)',
        border: '0.5px solid var(--cf-purple-border)',
      };
  }
}

function getMessageColor(level: LogLine['level']): string {
  switch (level) {
    case 'main':
      return 'var(--lp-text-primary)';
    case 'warn':
      return 'var(--cf-amber)';
    case 'error':
      return 'var(--cf-red)';
    case 'info':
    default:
      return 'var(--lp-text-secondary)';
  }
}

export default function LogStream({ lines }: LogStreamProps) {
  const logAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      style={{
        background: 'var(--cf-bg-base)',
        borderRadius: '10px',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="log"
      aria-label="Live build logs"
      aria-live="polite"
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--lp-border)',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '9px',
            letterSpacing: '0.1em',
            color: 'var(--lp-text-hint)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            textTransform: 'uppercase',
          }}
        >
          Live Logs
        </span>

        <div
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span
            style={{
              fontSize: '9px',
              color: 'var(--lp-text-hint)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            auto-scroll
          </span>
          <span
            className="animate-pulse"
            aria-hidden
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--lp-accent)',
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* Log area */}
      <div
        ref={logAreaRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '12px',
        }}
      >
        {lines.map((line, index) => {
          const badgeStyle = getBadgeStyle(line.level);
          const messageColor = getMessageColor(line.level);

          return (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                height: '22px',
                borderRadius: '4px',
                paddingLeft: '4px',
                paddingRight: '4px',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--lp-border)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              {/* Timestamp */}
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--lp-text-hint)',
                  width: '56px',
                  flexShrink: 0,
                }}
                aria-label={`Time: ${line.timestamp}`}
              >
                {line.timestamp}
              </span>

              {/* Agent badge */}
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 7px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  flexShrink: 0,
                  minWidth: '48px',
                  textAlign: 'center',
                  ...badgeStyle,
                }}
              >
                {line.agent}
              </span>

              {/* Message */}
              <span
                style={{
                  color: messageColor,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {line.message}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
