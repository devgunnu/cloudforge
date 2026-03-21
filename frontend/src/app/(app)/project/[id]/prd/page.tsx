'use client';

import { useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/projectStore';
import ChatThread from '@/components/cloudforge/ChatThread';
import CenterInputBar from '@/components/cloudforge/CenterInputBar';
import type { ChatMessage } from '@/components/cloudforge/ChatThread';

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'agent',
    content:
      "Hi! I'm your CloudForge architect agent. Tell me about what you're building — paste a PRD, describe your product, or start with a few sentences.",
    timestamp: '09:10:02',
  },
  {
    id: '2',
    role: 'user',
    content:
      'I need a REST API with JWT authentication, rate limiting per user tier, and an admin dashboard to manage API keys and monitor usage.',
    timestamp: '09:10:45',
  },
  {
    id: '3',
    role: 'agent',
    content:
      'Got it — a developer-facing API platform with auth, tiering, and an ops dashboard. A few questions to nail the architecture:\n\n1. Expected QPS at launch vs peak?\n2. Multi-region or single-region to start?\n3. Any existing infra to integrate with?',
    timestamp: '09:11:02',
  },
  {
    id: '4',
    role: 'user',
    content: '~500 rps launch, 5k peak. Single region (us-east-1). No existing infra, greenfield.',
    timestamp: '09:11:38',
  },
  {
    id: '5',
    role: 'agent',
    content:
      "Perfect. Greenfield us-east-1, 5k rps peak — we'll size Lambda concurrency and ElastiCache for that headroom. One more: PostgreSQL or DynamoDB for the API key store?",
    timestamp: '09:11:55',
  },
  {
    id: '6',
    role: 'user',
    content: 'Postgres. I want relational queries for the dashboard analytics.',
    timestamp: '09:12:20',
  },
  {
    id: '7',
    role: 'agent',
    content: "Here's the functional plan I've drafted based on your requirements:",
    timestamp: '09:12:45',
    planCard: {
      functional: [
        'JWT auth with RS256 signing',
        'Rate limiting via sliding window (Redis)',
        'REST API versioning (/v1, /v2)',
        'API key CRUD + rotation',
      ],
      features: [
        'Admin dashboard (usage graphs, key management)',
        'Per-tier rate limit config',
        'Webhook delivery for quota events',
        'OpenAPI spec auto-generation',
      ],
    },
  },
  {
    id: '8',
    role: 'agent',
    content: 'Does this match what you had in mind? Accept to move to architecture, or suggest changes.',
    timestamp: '09:12:46',
  },
];

const hasPlanCard = MOCK_MESSAGES.some((m) => m.planCard);

export default function PRDPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { advanceStage } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

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
      {/* Scrollable chat area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 0',
        }}
      >
        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            width: '100%',
            padding: '0 24px',
          }}
        >
          <ChatThread messages={MOCK_MESSAGES} />

          {/* Plan acceptance actions — shown when conversation has a plan card */}
          {hasPlanCard && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '16px',
                marginLeft: '40px',
              }}
            >
              <button
                className="lp-btn-primary"
                style={{
                  padding: '10px 20px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                }}
                aria-label="Accept the functional plan and proceed to architecture"
                onClick={() => {
                  advanceStage(id);
                  router.push(`/project/${id}/arch`);
                }}
              >
                Accept plan
              </button>
              <button
                className="lp-btn-ghost"
                style={{
                  padding: '10px 20px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                }}
                aria-label="Suggest changes to the functional plan"
              >
                Suggest changes
              </button>
            </div>
          )}

          {/* Bottom padding so sticky input bar doesn't overlap last message */}
          <div style={{ height: '80px' }} />
        </div>
      </div>

      {/* Sticky input bar — rendered inside the scroll container so sticky works */}
      <div
        style={{
          position: 'relative',
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%',
          padding: '0 24px 24px',
        }}
      >
        <CenterInputBar placeholder="Describe your product or paste a PRD..." />
      </div>
    </div>
  );
}
