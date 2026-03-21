'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProjectStore } from '@/store/projectStore';
import CenterInputBar from '@/components/cloudforge/CenterInputBar';
import ArchDiagram from '@/components/cloudforge/ArchDiagram';
import FileTree from '@/components/cloudforge/FileTree';
import ToggleGroup from '@/components/cloudforge/ToggleGroup';
import type { ArchNode, ArchEdge, FileNode } from '@/lib/mock-data';

/* ── Local types ─────────────────────────────────────────────────────────────── */

interface MiniMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
}

/* ── Mock data ───────────────────────────────────────────────────────────────── */

const ARCH_NODES: ArchNode[] = [
  { id: 'apigw', label: 'API Gateway', sublabel: 'REST \u00b7 edge', layer: 'app', x: 0, y: 60 },
  { id: 'lambda', label: 'Lambda', sublabel: 'nodejs20 \u00b7 512mb', layer: 'app', x: 200, y: 60 },
  { id: 'elasticache', label: 'ElastiCache', sublabel: 'Redis \u00b7 r7g.large', layer: 'app', x: 400, y: 60, isNew: true },
  { id: 'rds', label: 'RDS (Postgres)', sublabel: 'postgres15 \u00b7 t3.medium', layer: 'app', x: 620, y: 60 },
  { id: 'vpc', label: 'VPC', sublabel: '10.0.0.0/16', layer: 'infra', x: 0, y: 240 },
  { id: 'iam', label: 'IAM Roles', sublabel: 'least-privilege', layer: 'infra', x: 200, y: 240 },
  { id: 'cloudwatch', label: 'CloudWatch', sublabel: 'logs + metrics', layer: 'infra', x: 400, y: 240 },
  { id: 's3', label: 'S3', sublabel: 'artifacts \u00b7 versioned', layer: 'infra', x: 620, y: 240 },
];

const ARCH_EDGES: ArchEdge[] = [
  { from: 'apigw', to: 'lambda' },
  { from: 'lambda', to: 'elasticache' },
  { from: 'lambda', to: 'rds' },
  { from: 'lambda', to: 's3' },
];

const MOCK_FILES: FileNode[] = [
  {
    name: 'infra', type: 'dir', children: [
      { name: 'main.tf', type: 'file', status: 'done', category: 'infra' },
      { name: 'vpc.tf', type: 'file', status: 'done', category: 'infra' },
      { name: 'rds.tf', type: 'file', status: 'done', category: 'infra' },
    ],
  },
  {
    name: 'src', type: 'dir', children: [
      {
        name: 'auth', type: 'dir', children: [
          { name: 'jwt.ts', type: 'file', status: 'done', category: 'src' },
          { name: 'middleware.ts', type: 'file', status: 'writing', category: 'src' },
        ],
      },
      {
        name: 'api', type: 'dir', children: [
          { name: 'routes.ts', type: 'file', status: 'done', category: 'src' },
          { name: 'handlers.ts', type: 'file', status: 'writing', category: 'src' },
        ],
      },
      {
        name: 'db', type: 'dir', children: [
          { name: 'migrations.ts', type: 'file', status: 'pending', category: 'src' },
        ],
      },
    ],
  },
  {
    name: 'config', type: 'dir', children: [
      { name: 'serverless.yml', type: 'file', status: 'pending', category: 'config' },
    ],
  },
];

const CHAT_MESSAGES: MiniMessage[] = [
  {
    id: 'msg-1',
    role: 'agent',
    content: 'Your architecture needs 2 NFR decisions before I generate Terraform:',
  },
  {
    id: 'msg-2',
    role: 'agent',
    content: '1. Multi-AZ RDS? Adds ~$180/mo but gives automatic failover.\n2. NAT Gateway for Lambda egress, or VPC endpoints only?',
  },
  {
    id: 'msg-3',
    role: 'user',
    content: 'Yes, enable Multi-AZ.',
  },
  {
    id: 'msg-4',
    role: 'agent',
    content: 'Got it \u2014 Multi-AZ RDS enabled. Now for networking:',
  },
  {
    id: 'msg-5',
    role: 'user',
    content: 'VPC endpoints \u2014 keep costs down.',
  },
  {
    id: 'msg-6',
    role: 'agent',
    content: 'Perfect. Architecture locked. ElastiCache added for rate limiting. Ready to build?',
  },
];

/* ── Page ─────────────────────────────────────────────────────────────────────── */

export default function ArchPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { advanceStage } = useProjectStore();
  const [activePanel, setActivePanel] = useState('Chat');
  const [accepting, setAccepting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAccept = () => {
    setAccepting(true);
    advanceStage(id);
    router.push(`/project/${id}/build`);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--lp-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Body: left panel + right canvas */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
        {/* Left panel - 280px */}
        <div
          style={{
            width: '280px',
            flexShrink: 0,
            background: 'var(--lp-surface)',
            borderRight: '0.5px solid var(--lp-border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Toggle */}
          <div style={{ padding: '12px 12px 0' }}>
            <ToggleGroup
              options={['Chat', 'Files']}
              value={activePanel}
              onChange={setActivePanel}
            />
          </div>

          {/* Panel content */}
          {activePanel === 'Chat' ? (
            <ChatPanel scrollRef={scrollRef} onAccept={handleAccept} accepting={accepting} />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <FileTree nodes={MOCK_FILES} />
            </div>
          )}
        </div>

        {/* Right canvas */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            padding: '24px',
            background: 'var(--cf-bg-base)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--lp-text-hint)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              marginBottom: '16px',
              flexShrink: 0,
            }}
          >
            Architecture diagram
          </span>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <ArchDiagram nodes={ARCH_NODES} edges={ARCH_EDGES} />
          </div>
        </div>
      </div>

      {/* Bottom input bar */}
      <div
        style={{
          padding: '16px 24px',
          background: 'var(--lp-bg)',
          borderTop: '0.5px solid var(--lp-border)',
          flexShrink: 0,
        }}
      >
        <CenterInputBar placeholder="Ask agent to change the architecture..." />
      </div>
    </div>
  );
}

/* ── Chat panel ──────────────────────────────────────────────────────────────── */

function ChatPanel({ scrollRef, onAccept, accepting }: { scrollRef: React.RefObject<HTMLDivElement | null>; onAccept: () => void; accepting: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {CHAT_MESSAGES.map((msg, index) => (
          <MiniChatBubble key={msg.id} message={msg} index={index} />
        ))}
      </div>

      {/* Action buttons pinned at bottom */}
      <div
        style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderTop: '0.5px solid var(--lp-border)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="lp-btn-primary"
          style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            cursor: accepting ? 'default' : 'pointer',
            border: 'none',
            opacity: accepting ? 0.7 : 1,
          }}
          disabled={accepting}
          onClick={onAccept}
        >
          {accepting ? 'Building...' : 'Accept + build'}
        </button>
        <button
          type="button"
          className="lp-btn-ghost"
          style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: 'var(--lp-text-secondary)',
          }}
        >
          Suggest more
        </button>
      </div>
    </div>
  );
}

/* ── Mini chat bubble ────────────────────────────────────────────────────────── */

function MiniChatBubble({ message, index }: { message: MiniMessage; index: number }) {
  const isAgent = message.role === 'agent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: isAgent ? 'row' : 'row-reverse',
        gap: '8px',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        aria-hidden
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: isAgent ? 'var(--cf-purple-dim)' : 'var(--lp-elevated)',
          border: `0.5px solid ${isAgent ? 'var(--cf-purple-border)' : 'var(--lp-border-hover)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '8px',
            fontWeight: 700,
            color: isAgent ? 'var(--cf-purple)' : 'var(--lp-text-secondary)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            lineHeight: 1,
          }}
        >
          {isAgent ? 'CF' : 'GS'}
        </span>
      </div>

      {/* Bubble */}
      <div
        style={{
          background: isAgent ? 'var(--lp-bg)' : 'var(--lp-accent-glow)',
          border: `0.5px solid ${isAgent ? 'var(--lp-border)' : 'var(--lp-accent-dim)'}`,
          borderRadius: isAgent ? '0 10px 10px 10px' : '10px 0 10px 10px',
          padding: '8px 12px',
          maxWidth: '200px',
        }}
      >
        <p
          style={{
            fontSize: '12px',
            color: 'var(--lp-text-primary)',
            lineHeight: 1.5,
            margin: 0,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          }}
        >
          {message.content}
        </p>
      </div>
    </motion.div>
  );
}
