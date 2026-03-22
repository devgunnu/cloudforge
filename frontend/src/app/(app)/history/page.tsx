'use client';

import { useState, useEffect } from 'react';
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

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── API ───────────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('cloudforge-auth');
    if (!stored) return {};
    const token = JSON.parse(stored)?.state?.accessToken;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

interface BuildRecord {
  id: string;
  project_id: string;
  project_name: string;
  status: string;
  created_at: string;
  artifacts_count?: number;
  generated_files_count?: number;
}

interface DeploymentRecord {
  id: string;
  project_id: string;
  project_name: string;
  status: string;
  provider?: string;
  region?: string;
  created_at: string;
}

interface PrdRecord {
  id: string;
  project_id: string;
  project_name: string;
  session_id?: string;
  status: string;
  created_at: string;
}

function normalizeStatus(raw: string): EventStatus {
  const s = raw.toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'done') return 'success';
  if (s === 'failed' || s === 'error') return 'failed';
  return 'in_progress';
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

function mapBuildToEvent(b: BuildRecord): HistoryEvent {
  const status = normalizeStatus(b.status);
  const fileCount = b.generated_files_count ?? b.artifacts_count;
  const description = fileCount != null
    ? `Terraform plan generated — ${fileCount} file${fileCount === 1 ? '' : 's'} produced`
    : 'Build completed';
  return {
    id: `build-${b.id}`,
    type: status === 'failed' ? 'error' : 'build',
    status,
    project: b.project_name || b.project_id,
    description,
    region: '',
    timestamp: formatTimestamp(b.created_at),
  };
}

function mapDeploymentToEvent(d: DeploymentRecord): HistoryEvent {
  const status = normalizeStatus(d.status);
  const region = d.region || d.provider || 'unknown';
  const description = status === 'failed'
    ? `Deploy failed — ${region}`
    : `Deployed to ${region}`;
  return {
    id: `deploy-${d.id}`,
    type: status === 'failed' ? 'error' : 'deploy',
    status,
    project: d.project_name || d.project_id,
    description,
    region,
    timestamp: formatTimestamp(d.created_at),
  };
}

function mapPrdToEvent(p: PrdRecord): HistoryEvent {
  const status = normalizeStatus(p.status);
  const description = status === 'failed'
    ? 'PRD processing failed'
    : 'PRD confirmed — requirements locked';
  return {
    id: `prd-${p.id}`,
    type: 'prd',
    status,
    project: p.project_name || p.project_id,
    description,
    region: '',
    timestamp: formatTimestamp(p.created_at),
  };
}

async function fetchHistory(): Promise<HistoryEvent[]> {
  const headers = { ...authHeaders(), 'Content-Type': 'application/json' };

  const [buildsRes, deploymentsRes, prdsRes] = await Promise.allSettled([
    fetch(`${API_URL}/history/builds?limit=20`, { headers }),
    fetch(`${API_URL}/history/deployments?limit=20`, { headers }),
    fetch(`${API_URL}/history/prd?limit=20`, { headers }),
  ]);

  const events: HistoryEvent[] = [];

  if (buildsRes.status === 'fulfilled' && buildsRes.value.ok) {
    const data: BuildRecord[] = await buildsRes.value.json();
    events.push(...data.map(mapBuildToEvent));
  }

  if (deploymentsRes.status === 'fulfilled' && deploymentsRes.value.ok) {
    const data: DeploymentRecord[] = await deploymentsRes.value.json();
    events.push(...data.map(mapDeploymentToEvent));
  }

  if (prdsRes.status === 'fulfilled' && prdsRes.value.ok) {
    const data: PrdRecord[] = await prdsRes.value.json();
    events.push(...data.map(mapPrdToEvent));
  }

  // Sort by timestamp descending (newest first)
  events.sort((a, b) => {
    try {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } catch {
      return 0;
    }
  });

  return events;
}

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
    case 'success':     return '#34d399';
    case 'failed':      return '#f87171';
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

function SkeletonRow({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        alignItems: 'start',
        gap: '12px',
        padding: '14px 0',
        borderBottom: '0.5px solid var(--lp-border)',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'var(--lp-elevated)',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
        <div style={{ width: '120px', height: '10px', borderRadius: '4px', background: 'var(--lp-elevated)' }} />
        <div style={{ width: '260px', height: '10px', borderRadius: '4px', background: 'var(--lp-elevated)' }} />
        <div style={{ width: '80px', height: '9px', borderRadius: '4px', background: 'var(--lp-elevated)' }} />
      </div>
      <div style={{ width: '56px', height: '10px', borderRadius: '4px', background: 'var(--lp-elevated)', marginTop: '4px' }} />
    </motion.div>
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
          {event.region && (
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-text-hint)',
              }}
            >
              {event.region}
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
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchHistory()
      .then((data) => {
        if (!cancelled) {
          setEvents(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all'
    ? events
    : filter === 'error'
      ? events.filter((e) => e.status === 'failed')
      : events.filter((e) => e.type === filter);

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
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} role="listitem">
              <SkeletonRow index={i} />
            </div>
          ))
        ) : error ? (
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              color: '#f87171',
              marginTop: '48px',
            }}
            role="alert"
          >
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--lp-text-secondary)',
              marginTop: '48px',
            }}
          >
            {events.length === 0 ? 'No activity yet.' : 'No events match this filter.'}
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
