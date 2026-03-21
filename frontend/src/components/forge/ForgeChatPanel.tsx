'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronRight, ChevronDown, FileCode2 } from 'lucide-react';
import {
  useForgeStore,
  FORGE_STAGE_LABELS,
  type ForgeStage,
  type ForgeChatMessage,
  type GeneratedFile,
} from '@/store/forgeStore';

// ── Agent pill ────────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<
  ForgeStage,
  { label: string; num: number; color: string; dim: string; border: string }
> = {
  requirements: {
    label: 'Requirements',
    num: 1,
    color: '#a78bfa',
    dim: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
  architecture: {
    label: 'Architecture',
    num: 2,
    color: 'var(--lp-accent)',
    dim: 'var(--lp-accent-dim)',
    border: 'rgba(45,212,191,0.25)',
  },
  build: {
    label: 'Build',
    num: 3,
    color: '#f59e0b',
    dim: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
  },
  deploy: {
    label: 'Deploy',
    num: 3,
    color: '#34d399',
    dim: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.25)',
  },
};

function AgentPill({ stage }: { stage: ForgeStage }) {
  const cfg = AGENT_CONFIG[stage];
  return (
    <motion.div
      key={stage}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '5px 10px',
        background: cfg.dim,
        border: `0.5px solid ${cfg.border}`,
        borderRadius: '100px',
        flexShrink: 0,
      }}
      aria-label={`Active: Agent ${cfg.num} — ${cfg.label}`}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.color}`,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          color: cfg.color,
          letterSpacing: '0.01em',
        }}
      >
        Agent {cfg.num} — {cfg.label}
      </span>
    </motion.div>
  );
}

// ── Constraint chip row ───────────────────────────────────────────────────────

const CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  performance: {
    bg: 'rgba(45,212,191,0.08)',
    border: 'rgba(45,212,191,0.2)',
    text: 'var(--lp-accent)',
  },
  security: {
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
    text: '#a78bfa',
  },
  cost: {
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.2)',
    text: '#34d399',
  },
  reliability: {
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    text: '#f59e0b',
  },
};

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ card }: { card: NonNullable<ForgeChatMessage['activityCard']> }) {
  const { openFile } = useForgeStore();
  const isProcessing = card.status === 'processing';

  return (
    <div
      style={{
        background: 'var(--lp-elevated)',
        border: `0.5px solid ${isProcessing ? 'rgba(245,158,11,0.25)' : 'rgba(52,211,153,0.2)'}`,
        borderRadius: '9px',
        overflow: 'hidden',
        marginTop: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          borderBottom: card.files.length > 0 ? '0.5px solid var(--lp-border)' : 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontSize: '13px', color: isProcessing ? '#f59e0b' : '#34d399' }}
        >
          {isProcessing ? '⟳' : '✓'}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            fontWeight: 500,
            color: isProcessing ? '#f59e0b' : '#34d399',
          }}
        >
          {card.label}
        </span>
      </div>
      {card.files.map((f) => {
        const badgeColor =
          f.status === 'new'
            ? '#34d399'
            : f.status === 'modified'
              ? '#f59e0b'
              : 'var(--lp-text-hint)';

        return (
          <button
            key={f.id}
            type="button"
            onClick={() => f.status !== 'pending' && openFile(f.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '6px 10px',
              background: 'transparent',
              border: 'none',
              borderBottom: '0.5px solid var(--lp-border)',
              cursor: f.status === 'pending' ? 'default' : 'pointer',
              transition: 'background 120ms ease',
              textAlign: 'left',
            }}
            aria-label={`Open file ${f.name}`}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: f.status === 'pending' ? 'var(--lp-text-hint)' : 'var(--lp-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <FileCode2 size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
              {f.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: badgeColor,
                background: `${badgeColor}18`,
                border: `0.5px solid ${badgeColor}33`,
                borderRadius: '4px',
                padding: '1px 5px',
                flexShrink: 0,
                textTransform: 'uppercase',
              }}
            >
              {f.status === 'pending' ? 'pending' : f.status === 'new' ? 'N' : 'M'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ForgeChatMessage }) {
  const isAgent = message.role === 'agent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isAgent ? 'flex-start' : 'flex-end',
        gap: '4px',
        marginBottom: '10px',
      }}
    >
      {isAgent && message.content && (
        <div
          style={{
            maxWidth: '90%',
            background: 'var(--lp-elevated)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '10px 10px 10px 3px',
            padding: '9px 11px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {message.content}
          </p>
        </div>
      )}

      {!isAgent && (
        <div
          style={{
            maxWidth: '85%',
            background: 'var(--lp-accent-dim)',
            border: '0.5px solid rgba(45,212,191,0.2)',
            borderRadius: '10px 10px 3px 10px',
            padding: '9px 11px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-primary)',
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {message.content}
          </p>
        </div>
      )}

      {/* Constraint chips */}
      {message.chips && message.chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '100%' }}>
          {message.chips.map((chip) => {
            const style = CHIP_COLORS[chip.category] ?? CHIP_COLORS.performance;
            return (
              <span
                key={chip.id}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '10px',
                  fontWeight: 500,
                  color: style.text,
                  background: style.bg,
                  border: `0.5px solid ${style.border}`,
                  borderRadius: '100px',
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Activity card */}
      {message.activityCard && (
        <ActivityCard card={message.activityCard} />
      )}
    </motion.div>
  );
}

// ── File tree (Files tab) ─────────────────────────────────────────────────────

interface FileTreeDir {
  name: string;
  files: GeneratedFile[];
}

function FileTree() {
  const { generatedFiles, openFile } = useForgeStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const files = Object.values(generatedFiles);

  // Group by directory
  const dirs: Record<string, GeneratedFile[]> = {};
  for (const f of files) {
    const parts = f.path.split('/');
    const dir = parts.length > 1 ? parts[0] : '_root';
    if (!dirs[dir]) dirs[dir] = [];
    dirs[dir].push(f);
  }

  if (files.length === 0) {
    return (
      <div
        style={{
          padding: '24px 12px',
          textAlign: 'center',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          color: 'var(--lp-text-hint)',
          lineHeight: 1.5,
        }}
      >
        No files generated yet.
        <br />
        Start the Build stage to see code here.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {Object.entries(dirs).map(([dir, dirFiles]) => {
        const isCollapsed = collapsed[dir] ?? false;

        return (
          <div key={dir}>
            {dir !== '_root' && (
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [dir]: !prev[dir] }))
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight size={11} aria-hidden="true" style={{ color: 'var(--lp-text-hint)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={11} aria-hidden="true" style={{ color: 'var(--lp-text-hint)', flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: '11px',
                    color: 'var(--lp-text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  {dir}/
                </span>
              </button>
            )}

            {!isCollapsed &&
              dirFiles.map((file) => {
                const badgeColor =
                  file.status === 'new'
                    ? '#34d399'
                    : file.status === 'modified'
                      ? '#f59e0b'
                      : 'var(--lp-text-hint)';

                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => file.status !== 'pending' && openFile(file.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      padding: '5px 10px 5px 22px',
                      background: 'transparent',
                      border: 'none',
                      cursor: file.status === 'pending' ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                    aria-label={`Open ${file.name}`}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '11px',
                        color:
                          file.status === 'pending'
                            ? 'var(--lp-text-hint)'
                            : 'var(--lp-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <FileCode2
                        size={10}
                        aria-hidden="true"
                        style={{ flexShrink: 0, opacity: 0.6 }}
                      />
                      {file.name}
                    </span>
                    {file.status !== 'modified' || true ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-inter), system-ui, sans-serif',
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          color: badgeColor,
                          flexShrink: 0,
                        }}
                        aria-label={`Status: ${file.status}`}
                      >
                        {file.status === 'pending'
                          ? '···'
                          : file.status === 'new'
                            ? 'N'
                            : 'M'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

// ── Files empty state ─────────────────────────────────────────────────────────

function FilesEmptyState() {
  return (
    <div
      style={{
        padding: '32px 12px',
        textAlign: 'center',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '12px',
        color: 'var(--lp-text-hint)',
        lineHeight: 1.6,
      }}
    >
      <FileCode2
        size={20}
        aria-hidden="true"
        style={{ color: 'var(--lp-text-hint)', marginBottom: '8px', opacity: 0.5 }}
      />
      <p>Files appear here during the Build stage.</p>
    </div>
  );
}

// ── Input bar ─────────────────────────────────────────────────────────────────

const PLACEHOLDER: Record<ForgeStage, string> = {
  requirements: 'Ask Agent 1 to refine requirements…',
  architecture: 'Ask Agent 2 about the architecture…',
  build: 'Ask Agent 3 to modify the code…',
  deploy: 'Ask Agent 3 about the deployment…',
};

function InputBar({ stage }: { stage: ForgeStage }) {
  const { addChatMessage } = useForgeStore();
  const [value, setValue] = useState('');

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    addChatMessage(stage, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
    });
    setValue('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      style={{
        padding: '10px 10px',
        borderTop: '0.5px solid var(--lp-border)',
        display: 'flex',
        gap: '6px',
        alignItems: 'flex-end',
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder={PLACEHOLDER[stage]}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--lp-elevated)',
          border: '0.5px solid var(--lp-border-hover)',
          borderRadius: '8px',
          padding: '8px 10px',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          color: 'var(--lp-text-primary)',
          outline: 'none',
          lineHeight: 1.5,
          maxHeight: '80px',
          overflow: 'auto',
        }}
        aria-label="Message input"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!value.trim()}
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '8px',
          background: value.trim() ? 'var(--lp-accent-dim)' : 'transparent',
          border: `0.5px solid ${value.trim() ? 'rgba(45,212,191,0.3)' : 'var(--lp-border)'}`,
          color: value.trim() ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
          cursor: value.trim() ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 120ms ease',
        }}
        aria-label="Send message"
      >
        <Send size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

export default function ForgeChatPanel() {
  const { activeStage, stageStatus, chatHistory } = useForgeStore();
  const [tab, setTab] = useState<'chat' | 'files'>('chat');
  const threadRef = useRef<HTMLDivElement>(null);

  const messages = chatHistory[activeStage];
  const showFiles =
    activeStage === 'build' || activeStage === 'deploy';

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (tab === 'chat' && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, tab]);

  return (
    <aside
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--lp-surface)',
        borderRight: '0.5px solid var(--lp-border)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      aria-label="Agent chat panel"
    >
      {/* Agent pill */}
      <div
        style={{
          padding: '10px',
          borderBottom: '0.5px solid var(--lp-border)',
          flexShrink: 0,
        }}
      >
        <AnimatePresence mode="wait">
          <AgentPill key={activeStage} stage={activeStage} />
        </AnimatePresence>
        {stageStatus[activeStage] === 'processing' && (
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '10px',
              color: 'var(--lp-text-hint)',
              marginTop: '6px',
              paddingLeft: '2px',
            }}
          >
            {FORGE_STAGE_LABELS[activeStage]} agent is running…
          </p>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '0.5px solid var(--lp-border)',
          flexShrink: 0,
        }}
        role="tablist"
        aria-label="Chat panel tabs"
      >
        {(['chat', 'files'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: `1.5px solid ${tab === t ? 'var(--lp-accent)' : 'transparent'}`,
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              fontWeight: tab === t ? 500 : 400,
              color: tab === t ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
              cursor: 'pointer',
              transition: 'color 120ms ease, border-color 120ms ease',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panel body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'chat' ? (
          <div
            ref={threadRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 10px',
            }}
            role="log"
            aria-label="Chat thread"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  color: 'var(--lp-text-hint)',
                  textAlign: 'center',
                  marginTop: '16px',
                  lineHeight: 1.5,
                }}
              >
                Agent is warming up…
              </p>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }} role="region" aria-label="Generated files">
            {showFiles ? <FileTree /> : <FilesEmptyState />}
          </div>
        )}
      </div>

      {/* Input bar — always rendered */}
      <InputBar stage={activeStage} />
    </aside>
  );
}
