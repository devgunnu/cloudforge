'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import type { ForgeStage } from '@/store/forgeStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuggestedCommand {
  id: string;
  label: string;
  payload: string;
}

export interface SuggestedCommandsProps {
  stage: ForgeStage;
  onSelect: (command: SuggestedCommand) => void;
  disabled?: boolean;
}

// ── Stage accent colours (mirrors AGENT_CONFIG in ForgeChatPanel) ─────────────

const STAGE_ACCENT: Record<ForgeStage, { color: string; border: string; glow: string }> = {
  requirements: {
    color: '#a78bfa',
    border: 'rgba(167,139,250,0.4)',
    glow: 'rgba(167,139,250,0.15)',
  },
  architecture: {
    color: 'var(--lp-accent)',
    border: 'rgba(45,212,191,0.4)',
    glow: 'var(--lp-accent-glow)',
  },
  build: {
    color: '#f59e0b',
    border: 'rgba(245,158,11,0.4)',
    glow: 'rgba(245,158,11,0.10)',
  },
  deploy: {
    color: '#34d399',
    border: 'rgba(52,211,153,0.4)',
    glow: 'rgba(52,211,153,0.10)',
  },
};

// ── Hardcoded commands per stage ──────────────────────────────────────────────

const STAGE_COMMANDS: Record<ForgeStage, SuggestedCommand[]> = {
  requirements: [
    {
      id: 'req-1',
      label: '🚀 E-commerce platform',
      payload:
        'Build a scalable e-commerce platform with user auth, product catalog, Stripe payments, and admin dashboard. Expected 10k daily users.',
    },
    {
      id: 'req-2',
      label: '⚡ Serverless API',
      payload:
        'Create a serverless REST API backend with JWT authentication, PostgreSQL database, rate limiting, and auto-scaling for a mobile app.',
    },
    {
      id: 'req-3',
      label: '🤖 ML pipeline',
      payload:
        'Design a machine learning data pipeline on AWS with S3 ingestion, SageMaker training, model registry, and real-time inference endpoint.',
    },
    {
      id: 'req-4',
      label: '💬 Real-time chat app',
      payload:
        'Build a real-time messaging application with WebSocket support, message persistence, user presence, and push notifications.',
    },
  ],
  architecture: [
    {
      id: 'arch-1',
      label: '✅ Looks good, proceed',
      payload: 'The architecture looks great. Please proceed to generate the infrastructure code.',
    },
    {
      id: 'arch-2',
      label: '💰 Optimize for cost',
      payload:
        'Optimize this architecture for minimum cost. Use spot instances, reserved capacity where appropriate, and remove any redundant services.',
    },
    {
      id: 'arch-3',
      label: '🔒 Enhance security',
      payload:
        'Enhance the security posture: add WAF, enable VPC isolation, add encryption at rest and in transit for all services.',
    },
    {
      id: 'arch-4',
      label: '📈 Scale for 1M users',
      payload:
        'Scale this architecture to handle 1 million daily users. Add auto-scaling groups, read replicas, and CDN caching.',
    },
  ],
  build: [
    {
      id: 'build-1',
      label: '📦 Generate all files',
      payload:
        'Generate all Terraform modules and application code files based on the approved architecture.',
    },
    {
      id: 'build-2',
      label: '🧪 Add tests',
      payload:
        'Add unit tests and integration tests for all Lambda functions and API endpoints.',
    },
    {
      id: 'build-3',
      label: '📋 Review main.tf',
      payload:
        'Show me a summary of the main Terraform configuration and explain the key resources being created.',
    },
  ],
  deploy: [
    {
      id: 'deploy-1',
      label: '🚀 Deploy to AWS',
      payload: 'Deploy all infrastructure to AWS us-east-1 using the generated Terraform files.',
    },
    {
      id: 'deploy-2',
      label: '📊 Show cost estimate',
      payload: 'Show me the estimated monthly cost breakdown for all deployed resources.',
    },
    {
      id: 'deploy-3',
      label: '🔄 Rollback',
      payload: 'Rollback all infrastructure changes to the previous stable state.',
    },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SuggestedCommands({ stage, onSelect, disabled = false }: SuggestedCommandsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const commands = STAGE_COMMANDS[stage];
  const accent = STAGE_ACCENT[stage];

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: '720px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Scroll container */}
      <div
        ref={scrollRef}
        role="group"
        aria-label="Suggested commands"
        data-suggested-commands-scroll=""
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '8px 16px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          // Hide scrollbar cross-browser
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          opacity: disabled ? 0.4 : 1,
          transition: 'opacity 200ms ease',
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        {commands.map((cmd, i) => (
          <Chip
            key={cmd.id}
            command={cmd}
            index={i}
            accent={accent}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Right-side fade + overflow arrow */}
      <OverflowIndicator />

      {/* Webkit scrollbar hide — injected inline to avoid globals */}
      <style>{`
        [data-suggested-commands-scroll]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

interface ChipProps {
  command: SuggestedCommand;
  index: number;
  accent: { color: string; border: string; glow: string };
  onSelect: (command: SuggestedCommand) => void;
}

function Chip({ command, index, accent, onSelect }: ChipProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 0.5, y: 0 }}
      transition={{
        duration: 0.25,
        delay: index * 0.055,
        ease: 'easeOut',
      }}
      whileHover={{
        opacity: 1,
        filter: 'blur(0px)',
        boxShadow: `0 0 10px ${accent.glow}, 0 0 0 1px ${accent.border}`,
        borderColor: accent.border,
        transition: { duration: 0.15 },
      }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(command)}
      aria-label={command.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        padding: '6px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        background: 'var(--cf-bg-elevated)',
        border: `0.5px solid var(--cf-border)`,
        color: 'var(--cf-text-muted)',
        cursor: 'pointer',
        filter: 'blur(0.5px)',
        outline: 'none',
        transition: 'color 150ms ease',
        lineHeight: 1,
      }}
      onFocus={(e) => {
        // Keyboard focus: treat same as hover — full opacity, no blur
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.filter = 'blur(0px)';
        e.currentTarget.style.borderColor = accent.border;
        e.currentTarget.style.color = 'var(--cf-text-primary)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.opacity = '0.5';
        e.currentTarget.style.filter = 'blur(0.5px)';
        e.currentTarget.style.borderColor = 'var(--cf-border)';
        e.currentTarget.style.color = 'var(--cf-text-muted)';
      }}
    >
      {command.label}
    </motion.button>
  );
}

// ── Overflow indicator ────────────────────────────────────────────────────────

function OverflowIndicator() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '48px',
        background:
          'linear-gradient(to right, transparent, var(--cf-bg-base) 90%)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '8px',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          color: 'var(--cf-text-hint)',
          userSelect: 'none',
        }}
      >
        →
      </span>
    </div>
  );
}
