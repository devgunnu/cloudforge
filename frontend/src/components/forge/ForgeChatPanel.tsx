'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronRight, ChevronDown, FileCode2 } from 'lucide-react';
import {
  useForgeStore,
  FORGE_STAGE_LABELS,
  type ForgeStage,
  type ForgeChatMessage,
  type GeneratedFile,
  type ConstraintChip,
  type ClarificationQuestion,
} from '@/store/forgeStore';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { streamSSE, authHeaders } from '@/lib/forge-agents';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

// ── Clarification card ────────────────────────────────────────────────────────

function ClarificationCard({
  questions,
  onSubmit,
  disabled,
}: {
  questions: ClarificationQuestion[];
  onSubmit: (answers: string[]) => void;
  disabled: boolean;
}) {
  // selections[i] = selected option index, or null
  const [selections, setSelections] = useState<(number | null)[]>(() =>
    questions.map(() => null)
  );
  // customText[i] = free-form input for the custom option in question i
  const [customText, setCustomText] = useState<string[]>(() =>
    questions.map(() => '')
  );

  const allAnswered = selections.every((sel, i) => {
    if (sel === null) return false;
    const opt = questions[i].options[sel];
    if (opt.is_custom) return customText[i].trim().length > 0;
    return true;
  });

  function handleOptionClick(qIdx: number, optIdx: number) {
    if (disabled) return;
    setSelections((prev) => {
      const next = [...prev];
      next[qIdx] = next[qIdx] === optIdx ? null : optIdx;
      return next;
    });
  }

  function handleSubmit() {
    if (!allAnswered || disabled) return;
    const answers = questions.map((q, i) => {
      const sel = selections[i]!;
      const opt = q.options[sel];
      return opt.is_custom ? customText[i].trim() : opt.label;
    });
    onSubmit(answers);
  }

  return (
    <div
      style={{
        background: 'var(--lp-elevated)',
        border: '0.5px solid var(--lp-border)',
        borderRadius: '10px 10px 10px 3px',
        padding: '12px',
        maxWidth: '90%',
        opacity: disabled ? 0.55 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {/* Header */}
      <p
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--lp-text-hint)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          margin: '0 0 10px 0',
        }}
      >
        A few quick questions
      </p>

      {questions.map((q, qIdx) => {
        const selectedOptIdx = selections[qIdx];
        const selectedOpt = selectedOptIdx !== null ? q.options[selectedOptIdx] : null;
        const showCustomInput = selectedOpt?.is_custom === true;

        return (
          <div
            key={qIdx}
            style={{ marginBottom: qIdx < questions.length - 1 ? '14px' : '0' }}
          >
            {/* Question label */}
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--lp-text-primary)',
                lineHeight: 1.45,
                margin: '0 0 7px 0',
              }}
            >
              {q.question}
            </p>

            {/* Option pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {q.options.map((opt, optIdx) => {
                const isSelected = selectedOptIdx === optIdx;
                return (
                  <button
                    key={`${qIdx}-${optIdx}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleOptionClick(qIdx, optIdx)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '100px',
                      border: `0.5px solid ${isSelected ? 'rgba(45,212,191,0.35)' : 'var(--lp-border)'}`,
                      background: isSelected ? 'var(--lp-accent-dim)' : 'transparent',
                      color: isSelected ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      fontWeight: isSelected ? 500 : 400,
                      cursor: disabled ? 'default' : 'pointer',
                      transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
                      outline: 'none',
                      lineHeight: 1.4,
                    }}
                    aria-pressed={isSelected}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Custom text input */}
            {showCustomInput && (
              <textarea
                value={customText[qIdx]}
                onChange={(e) => {
                  const next = [...customText];
                  next[qIdx] = e.target.value;
                  setCustomText(next);
                }}
                disabled={disabled}
                placeholder="Type your answer…"
                rows={2}
                style={{
                  marginTop: '7px',
                  width: '100%',
                  resize: 'none',
                  background: 'transparent',
                  border: '0.5px solid var(--lp-border-hover)',
                  borderRadius: '7px',
                  padding: '6px 8px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '11px',
                  color: 'var(--lp-text-primary)',
                  outline: 'none',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
                aria-label={`Custom answer for: ${q.question}`}
              />
            )}
          </div>
        );
      })}

      {/* Submit button */}
      <button
        type="button"
        disabled={!allAnswered || disabled}
        onClick={handleSubmit}
        style={{
          marginTop: '12px',
          padding: '5px 12px',
          borderRadius: '7px',
          border: `0.5px solid ${allAnswered && !disabled ? 'rgba(45,212,191,0.35)' : 'var(--lp-border)'}`,
          background: allAnswered && !disabled ? 'var(--lp-accent-dim)' : 'transparent',
          color: allAnswered && !disabled ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          cursor: allAnswered && !disabled ? 'pointer' : 'default',
          transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
          outline: 'none',
        }}
        aria-disabled={!allAnswered || disabled}
      >
        Submit →
      </button>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onClarificationSubmit,
  clarificationSubmitted,
}: {
  message: ForgeChatMessage;
  onClarificationSubmit?: (answers: string[]) => void;
  clarificationSubmitted?: boolean;
}) {
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

      {/* Clarification card */}
      {message.clarificationCard && onClarificationSubmit && (
        <ClarificationCard
          questions={message.clarificationCard.questions}
          onSubmit={onClarificationSubmit}
          disabled={clarificationSubmitted ?? false}
        />
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
                    {file.status !== 'pending' ? (
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
                        {file.status === 'new' ? 'N' : 'M'}
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

const CLOUD_PROVIDERS = [
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'GCP' },
  { value: 'azure', label: 'Azure' },
];

function InputBar({
  stage,
  onRegisterClarificationHandler,
}: {
  stage: ForgeStage;
  onRegisterClarificationHandler: (fn: (answers: string[]) => void) => void;
}) {
  const {
    addChatMessage,
    setConstraints,
    setStageStatus,
    setPrdText,
    setCurrentProjectId,
    currentProjectId,
    stageStatus,
  } = useForgeStore();
  const { createApiProject } = useProjectStore();
  const { accessToken } = useAuthStore();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState('aws');
  const abortRef = useRef<AbortController | null>(null);
  const providerRef = useRef(provider);

  // File attach state
  const [attachedFile, setAttachedFile] = useState<{ name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in w);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const contents = ev.target?.result as string;
      setValue((prev) => `${prev}\n\n[File: ${file.name}]\n${contents}`.trimStart());
      setAttachedFile({ name: file.name });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-attached if removed
    e.target.value = '';
  }

  function removeAttachment() {
    setAttachedFile(null);
  }

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    const SR = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } }; resultIndex: number }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    }) | undefined;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const results = event.results;
      let transcript = '';
      for (let i = event.resultIndex; i < Object.keys(results).length; i++) {
        transcript += results[i][0].transcript;
      }
      setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }
  useEffect(() => { providerRef.current = provider; }, [provider]);

  const currentProjectIdRef = useRef(currentProjectId);
  useEffect(() => { currentProjectIdRef.current = currentProjectId; }, [currentProjectId]);

  const streamPrd = useCallback(async (
    projectId: string,
    endpoint: 'start' | 'respond',
    text: string,
    signal: AbortSignal,
    cloudProvider: string,
  ) => {
    const url =
      endpoint === 'start'
        ? `${API_URL}/workflows/prd/v2/start/${projectId}`
        : `${API_URL}/workflows/prd/v2/respond/${projectId}`;

    const body =
      endpoint === 'start'
        ? JSON.stringify({ prd_text: text, cloud_provider: cloudProvider })
        : JSON.stringify({ message: text });

    const chips: ConstraintChip[] = [];

    await streamSSE(
      url,
      { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body },
      (data) => {
        try {
          const event = JSON.parse(data) as Record<string, unknown>;
          if (event.type === 'constraint' && event.chip) {
            const chip = event.chip as ConstraintChip;
            chips.push(chip);
            addChatMessage(stage, { id: `chip-${chip.id}-${Date.now()}`, role: 'agent', content: '', chips: [chip] });
          } else if (event.type === 'clarification_needed') {
            let qWithOpts = (event.questions_with_options as ClarificationQuestion[]) ?? [];
            const questions = (event.questions as string[]) ?? [];
            const msgId = `clarify-${Date.now()}`;
            setStageStatus('requirements', 'done'); // session exists; next send → /respond

            // If the LLM didn't produce structured options, synthesise a card
            // from the bare questions list so the card UI always renders.
            if (qWithOpts.length === 0 && questions.length > 0) {
              qWithOpts = questions.map((q) => ({
                question: q,
                original_question: q,
                options: [{ label: 'Custom…', value: '', is_custom: true }],
              }));
            }

            if (qWithOpts.length > 0) {
              addChatMessage(stage, {
                id: msgId,
                role: 'agent',
                content: '',
                clarificationCard: { id: msgId, questions: qWithOpts },
              });
            } else {
              addChatMessage(stage, { id: msgId, role: 'agent', content: 'Could you share more details about your requirements?' });
            }
          } else if (event.type === 'plan_ready') {
            setConstraints(chips);
            setStageStatus('requirements', 'done');
            if (event.plan_markdown && typeof event.plan_markdown === 'string') {
              setPrdText(event.plan_markdown);
            }
            addChatMessage(stage, { id: `plan-${Date.now()}`, role: 'agent', content: `Got it — ${chips.length} constraints extracted. Click "Generate Architecture →" when ready.` });
          } else if (event.type === 'error') {
            setStageStatus('requirements', 'locked');
            addChatMessage(stage, { id: `err-${Date.now()}`, role: 'agent', content: `Error: ${(event.message as string) ?? 'Something went wrong. Please try again.'}` });
          }
        } catch { /* ignore parse errors */ }
      },
      signal,
    );
  }, [addChatMessage, setConstraints, setStageStatus, setPrdText, stage]);

  // Register the clarification submit handler with ForgeChatPanel so it can be
  // passed down to MessageBubble without prop-drilling through Zustand state.
  useEffect(() => {
    onRegisterClarificationHandler(async (answers: string[]) => {
      const projectId = currentProjectIdRef.current;
      if (!projectId) return;
      const combinedAnswer = answers.join('\n');
      addChatMessage(stage, { id: `user-${Date.now()}`, role: 'user', content: combinedAnswer });
      setStageStatus('requirements', 'processing');
      abortRef.current = new AbortController();
      try {
        await streamPrd(projectId, 'respond', combinedAnswer, abortRef.current.signal, providerRef.current);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to reach the agent.';
        addChatMessage(stage, { id: `err-${Date.now()}`, role: 'agent', content: msg });
        setStageStatus('requirements', 'locked');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, streamPrd, addChatMessage, setStageStatus, onRegisterClarificationHandler]);

  async function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    addChatMessage(stage, { id: `user-${Date.now()}`, role: 'user', content: trimmed });
    setValue('');

    // Only requirements and architecture stages hit the backend
    if (stage !== 'requirements' && stage !== 'architecture') return;

    setSending(true);
    abortRef.current = new AbortController();

    try {
      if (stage === 'requirements') {
        const reqStatus = stageStatus['requirements'];

        // No project yet — create one automatically
        let projectId = currentProjectId;
        if (!projectId) {
          if (!accessToken) {
            addChatMessage(stage, { id: `err-${Date.now()}`, role: 'agent', content: 'You need to be logged in. Please refresh and log in again.' });
            return;
          }
          const project = await createApiProject(`project-${Date.now()}`, accessToken);
          projectId = project.id;
          setCurrentProjectId(projectId);
          setPrdText(trimmed);
        }

        // locked = no session started yet → call /start
        // done = session exists → call /respond for refinement
        // processing = already running → ignore
        if (reqStatus === 'processing') {
          addChatMessage(stage, { id: `busy-${Date.now()}`, role: 'agent', content: 'Agent is already running, please wait…' });
          return;
        }

        setStageStatus('requirements', 'processing');
        const endpoint = reqStatus === 'locked' ? 'start' : 'respond';
        await streamPrd(projectId, endpoint, trimmed, abortRef.current.signal, provider);

      } else if (stage === 'architecture') {
        if (!currentProjectId) {
          addChatMessage(stage, { id: `err-${Date.now()}`, role: 'agent', content: 'No active project found. Please start from the requirements stage.' });
          return;
        }
        await streamSSE(
          `${API_URL}/workflows/architecture/v2/respond/${currentProjectId}`,
          { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: [trimmed] }) },
          (data) => {
            try {
              const event = JSON.parse(data) as Record<string, unknown>;
              if (event.type === 'error') {
                addChatMessage(stage, { id: `err-${Date.now()}`, role: 'agent', content: `Error: ${(event.message as string) ?? 'Something went wrong.'}` });
              }
            } catch { /* ignore */ }
          },
          abortRef.current.signal,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reach the agent.';
      addChatMessage(stage, { id: `err-${Date.now()}`, role: 'agent', content: msg });
      setStageStatus('requirements', 'locked');
    } finally {
      setSending(false);
    }
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
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Attachment indicator */}
      {attachedFile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--lp-text-secondary)',
            padding: '2px 6px',
            background: 'var(--lp-elevated)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '6px',
            alignSelf: 'flex-start',
          }}
        >
          <span>{attachedFile.name} attached</span>
          <button
            type="button"
            onClick={removeAttachment}
            aria-label="Remove attachment"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--lp-text-hint)',
              padding: '0 2px',
              lineHeight: 1,
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={sending ? 'Agent is responding…' : PLACEHOLDER[stage]}
          disabled={sending}
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
            opacity: sending ? 0.5 : 1,
          }}
          aria-label="Message input"
        />

        {/* File attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: 'transparent',
            border: '0.5px solid var(--lp-border)',
            color: attachedFile ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
            cursor: sending ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 120ms ease',
          }}
          aria-label="Attach .txt file"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        {/* Voice input button */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleRecording}
            disabled={sending}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isRecording ? 'rgba(239,68,68,0.12)' : 'transparent',
              border: `0.5px solid ${isRecording ? 'rgba(239,68,68,0.4)' : 'var(--lp-border)'}`,
              color: isRecording ? '#ef4444' : 'var(--lp-text-hint)',
              cursor: sending ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 120ms ease',
              animation: isRecording ? 'forgeMicPulse 1.2s ease-in-out infinite' : 'none',
            }}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            aria-pressed={isRecording}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M19 10a7 7 0 01-14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!value.trim() || sending}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: value.trim() && !sending ? 'var(--lp-accent-dim)' : 'transparent',
            border: `0.5px solid ${value.trim() && !sending ? 'rgba(45,212,191,0.3)' : 'var(--lp-border)'}`,
            color: value.trim() && !sending ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
            cursor: value.trim() && !sending ? 'pointer' : 'default',
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

      {/* Cloud provider selector — only relevant on requirements stage */}
      {stage === 'requirements' && (
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={sending}
          aria-label="Cloud provider"
          style={{
            alignSelf: 'flex-start',
            background: 'var(--lp-elevated)',
            border: '0.5px solid var(--lp-border)',
            borderRadius: '6px',
            padding: '3px 8px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '11px',
            color: 'var(--lp-text-secondary)',
            cursor: sending ? 'default' : 'pointer',
            outline: 'none',
            opacity: sending ? 0.5 : 1,
          }}
        >
          {CLOUD_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

export default function ForgeChatPanel() {
  const { activeStage, stageStatus, chatHistory } = useForgeStore();
  const [tab, setTab] = useState<'chat' | 'files'>('chat');
  const threadRef = useRef<HTMLDivElement>(null);
  // Holds the clarification submit handler registered by InputBar
  const clarificationHandlerRef = useRef<((answers: string[]) => void) | null>(null);
  // Tracks which clarification card IDs have been submitted (to disable them)
  const [submittedCards, setSubmittedCards] = useState<Set<string>>(new Set());

  const messages = chatHistory[activeStage];
  const showFiles =
    activeStage === 'build' || activeStage === 'deploy';

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (tab === 'chat' && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, tab]);

  function handleClarificationSubmit(cardId: string, answers: string[]) {
    if (submittedCards.has(cardId)) return;
    setSubmittedCards((prev) => new Set(prev).add(cardId));
    clarificationHandlerRef.current?.(answers);
  }

  return (
    <>
    <style>{`
      @keyframes forgeMicPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
    `}</style>
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
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onClarificationSubmit={
                    msg.clarificationCard
                      ? (answers) => handleClarificationSubmit(msg.clarificationCard!.id, answers)
                      : undefined
                  }
                  clarificationSubmitted={
                    msg.clarificationCard ? submittedCards.has(msg.clarificationCard.id) : undefined
                  }
                />
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
      <InputBar
        stage={activeStage}
        onRegisterClarificationHandler={(fn) => { clarificationHandlerRef.current = fn; }}
      />
    </aside>
    </>
  );
}
