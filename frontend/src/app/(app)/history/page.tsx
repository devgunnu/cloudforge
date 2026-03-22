'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket,
  Hammer,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';

// ── Mock data ─────────────────────────────────────────────────────────────────

type EventType = 'deploy' | 'build' | 'prd' | 'error';
type EventStatus = 'success' | 'failed' | 'in_progress';

interface HistoryEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  project: string;
  description: string;
  region: string;
  timestamp: string;
  duration?: string;
}

const MOCK_HISTORY: HistoryEvent[] = [
  {
    id: 'evt-001',
    type: 'deploy',
    status: 'success',
    project: 'auth-service-api',
    description: 'Deployed to us-east-1 — 4 resources provisioned',
    region: 'us-east-1',
    timestamp: '2026-03-21 · 14:32',
    duration: '2m 14s',
  },
  {
    id: 'evt-002',
    type: 'build',
    status: 'success',
    project: 'auth-service-api',
    description: 'Terraform plan generated — 4 to add, 0 to change',
    region: 'us-east-1',
    timestamp: '2026-03-21 · 14:28',
    duration: '44s',
  },
  {
    id: 'evt-003',
    type: 'prd',
    status: 'success',
    project: 'data-pipeline',
    description: 'PRD confirmed — 6 functional requirements locked',
    region: 'eu-west-2',
    timestamp: '2026-03-21 · 11:05',
  },
  {
    id: 'evt-004',
    type: 'build',
    status: 'in_progress',
    project: 'data-pipeline',
    description: 'Generating Terraform modules — writing lambda.tf',
    region: 'eu-west-2',
    timestamp: '2026-03-21 · 11:09',
    duration: '1m 32s',
  },
  {
    id: 'evt-005',
    type: 'error',
    status: 'failed',
    project: 'ml-inference-layer',
    description: 'Deploy failed — IAM role limit reached in us-west-2',
    region: 'us-west-2',
    timestamp: '2026-03-20 · 17:44',
  },
  {
    id: 'evt-006',
    type: 'build',
    status: 'failed',
    project: 'ml-inference-layer',
    description: 'Terraform apply aborted — resource limit exceeded',
    region: 'us-west-2',
    timestamp: '2026-03-20 · 17:42',
    duration: '58s',
  },
  {
    id: 'evt-007',
    type: 'deploy',
    status: 'success',
    project: 'auth-service-api',
    description: 'Rolled back to v1.2.0 — previous state restored',
    region: 'us-east-1',
    timestamp: '2026-03-19 · 09:18',
    duration: '1m 03s',
  },
  {
    id: 'evt-008',
    type: 'prd',
    status: 'success',
    project: 'auth-service-api',
    description: 'PRD updated — added rate limiting requirement',
    region: 'us-east-1',
    timestamp: '2026-03-18 · 16:55',
  },
  {
    id: 'evt-009',
    type: 'build',
    status: 'success',
    project: 'auth-service-api',
    description: 'Architecture diagram finalized — 8 nodes, 4 edges',
    region: 'us-east-1',
    timestamp: '2026-03-18 · 15:30',
    duration: '22s',
  },
  {
    id: 'evt-010',
    type: 'deploy',
    status: 'success',
    project: 'data-pipeline',
    description: 'Initial scaffold deployed — S3 + Glue + Lambda',
    region: 'eu-west-2',
    timestamp: '2026-03-17 · 13:10',
    duration: '3m 07s',
  },
  {
    id: 'evt-011',
    type: 'error',
    status: 'failed',
    project: 'data-pipeline',
    description: 'Build timeout — Glue job exceeded 5 min limit',
    region: 'eu-west-2',
    timestamp: '2026-03-16 · 22:11',
  },
  {
    id: 'evt-012',
    type: 'prd',
    status: 'success',
    project: 'ml-inference-layer',
    description: 'PRD saved — SageMaker endpoint spec confirmed',
    region: 'us-west-2',
    timestamp: '2026-03-15 · 10:02',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

type FilterType = 'all' | EventType;

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Deployments', value: 'deploy' },
  { label: 'Builds', value: 'build' },
  { label: 'PRDs', value: 'prd' },
  { label: 'Errors', value: 'error' },
];

function eventIcon(type: EventType) {
  const size = 13;
  switch (type) {
    case 'deploy': return <Rocket size={size} />;
    case 'build': return <Hammer size={size} />;
    case 'prd':   return <FileText size={size} />;
    case 'error': return <AlertTriangle size={size} />;
  }
}

function statusIcon(status: EventStatus) {
  switch (status) {
    case 'success':     return <CheckCircle2 size={13} />;
    case 'failed':      return <XCircle size={13} />;
    case 'in_progress': return <Clock size={13} />;
  }
}

function statusColor(status: EventStatus): string {
  switch (status) {
    case 'success':     return '#34d399'; // emerald
    case 'failed':      return '#f87171'; // red
    case 'in_progress': return 'var(--lp-accent)';
  }
}

function typeLabel(type: EventType): string {
  switch (type) {
    case 'deploy': return 'Deploy';
    case 'build':  return 'Build';
    case 'prd':    return 'PRD';
    case 'error':  return 'Error';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
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
        background: active
          ? 'var(--lp-accent-dim)'
          : hovered
            ? 'var(--lp-elevated)'
            : 'transparent',
        border: `0.5px solid ${active ? 'var(--lp-accent)' : hovered ? 'var(--lp-border-hover)' : 'var(--lp-border)'}`,
        borderRadius: '100px',
        padding: '4px 12px',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: 500,
        color: active ? 'var(--lp-accent)' : hovered ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function EventRow({ event, index }: { event: HistoryEvent; index: number }) {
  const color = statusColor(event.status);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        alignItems: 'start',
        gap: '12px',
        padding: '14px 0',
        borderBottom: '0.5px solid var(--lp-border)',
      }}
    >
      {/* Icon column */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'var(--lp-elevated)',
          border: '0.5px solid var(--lp-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--lp-text-secondary)',
          flexShrink: 0,
          marginTop: '1px',
        }}
        aria-hidden="true"
      >
        {eventIcon(event.type)}
      </div>

      {/* Main content */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
            flexWrap: 'wrap',
          }}
        >
          {/* Type pill */}
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'var(--lp-text-hint)',
              textTransform: 'uppercase',
            }}
          >
            {typeLabel(event.type)}
          </span>
          <span aria-hidden="true" style={{ color: 'var(--lp-border-hover)', fontSize: '10px' }}>·</span>
          {/* Project name */}
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--lp-text-primary)',
            }}
          >
            {event.project}
          </span>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-text-secondary)',
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          {event.description}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '11px',
              color: 'var(--lp-text-hint)',
            }}
          >
            {event.timestamp}
          </span>
          {event.duration && (
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-text-hint)',
              }}
            >
              {event.duration}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          color: color,
          flexShrink: 0,
          marginTop: '2px',
        }}
        aria-label={`Status: ${event.status}`}
      >
        {statusIcon(event.status)}
        {event.status === 'in_progress' ? 'Running' : event.status.charAt(0).toUpperCase() + event.status.slice(1)}
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = filter === 'all'
    ? MOCK_HISTORY
    : filter === 'error'
      ? MOCK_HISTORY.filter((e) => e.status === 'failed')
      : MOCK_HISTORY.filter((e) => e.type === filter);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        padding: '32px 40px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Activity history
        </h1>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--lp-text-hint)',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
          }}
          aria-hidden="true"
        >
          <Filter size={12} />
          Filter by type
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          flexWrap: 'wrap',
        }}
        role="group"
        aria-label="Filter activity by type"
      >
        {FILTERS.map((f) => (
          <FilterPill
            key={f.value}
            label={f.label}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
          />
        ))}
      </div>

      {/* Event list */}
      <div
        style={{ maxWidth: '720px' }}
        aria-label="Activity list"
        role="list"
      >
        {filtered.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--lp-text-secondary)',
              marginTop: '48px',
            }}
          >
            No events match this filter.
          </p>
        ) : (
          filtered.map((event, i) => (
            <div key={event.id} role="listitem">
              <EventRow event={event} index={i} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
