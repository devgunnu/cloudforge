'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForgeStore } from '@/store/forgeStore';
import { isDemoActive, useDemoStore } from '@/lib/demo/demoStore';
import { runDemoRequirements } from '@/lib/demo/demoService';
import type { ForgeChatMessage, ConstraintChip } from '@/store/forgeStore';

// ── Pulsing dot for processing state ─────────────────────────────────────────

function PulsingDot() {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--lp-accent)',
        marginRight: '6px',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}

// ── Simple markdown → HTML renderer ──────────────────────────────────────────

function renderMarkdown(raw: string): string {
  // Step 1: escape HTML
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Step 2: fenced code blocks (protect from further processing)
  const codeBlocks: string[] = [];
  s = s.replace(/```(?:[a-zA-Z]*)\n?([\s\S]*?)```/g, (_m, code: string) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:rgba(0,0,0,0.2);border:0.5px solid var(--lp-border);border-radius:8px;padding:12px 14px;overflow-x:auto;margin:10px 0"><code style="font-family:var(--font-jetbrains-mono),monospace;font-size:12px;color:var(--lp-text-primary);white-space:pre">${code}</code></pre>`
    );
    return `\x00CB${idx}\x00`;
  });

  // Step 3: inline code
  s = s.replace(/`([^`\n]+)`/g, (_m, code: string) =>
    `<code style="background:rgba(45,212,191,0.08);border:0.5px solid rgba(45,212,191,0.2);border-radius:4px;padding:1px 5px;font-family:var(--font-jetbrains-mono),monospace;font-size:12px;color:var(--lp-accent)">${code}</code>`
  );

  // Step 4: headers
  s = s
    .replace(/^#### (.+)$/gm, '<h4 style="font-family:var(--font-inter),system-ui,sans-serif;font-size:11px;font-weight:600;color:var(--lp-text-hint);margin:14px 0 4px;letter-spacing:0.06em;text-transform:uppercase">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="font-family:var(--font-inter),system-ui,sans-serif;font-size:13px;font-weight:600;color:var(--lp-text-primary);margin:16px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family:var(--font-inter),system-ui,sans-serif;font-size:15px;font-weight:600;color:var(--lp-text-primary);margin:20px 0 8px;padding-bottom:6px;border-bottom:0.5px solid var(--lp-border)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-family:var(--font-inter),system-ui,sans-serif;font-size:18px;font-weight:700;color:var(--lp-text-primary);margin:0 0 16px;letter-spacing:-0.02em">$1</h1>');

  // Step 5: bold + italic
  s = s
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong style="font-weight:600;color:var(--lp-text-primary)">$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em style="color:var(--lp-text-secondary)">$1</em>');

  // Step 6: horizontal rules
  s = s.replace(/^---$/gm, '<hr style="border:none;border-top:0.5px solid var(--lp-border);margin:16px 0"/>');

  // Step 7: blockquotes (> is already &gt; after escaping)
  s = s.replace(/^&gt; (.+)$/gm,
    '<blockquote style="border-left:2px solid var(--lp-accent);padding:4px 12px;margin:8px 0;color:var(--lp-text-secondary);font-style:italic">$1</blockquote>'
  );

  // Step 8: list items
  s = s.replace(/^[*-] (.+)$/gm,
    '<li style="margin:3px 0;color:var(--lp-text-secondary);line-height:1.6;padding-left:4px">$1</li>'
  );
  s = s.replace(/^\d+\. (.+)$/gm,
    '<li style="margin:3px 0;color:var(--lp-text-secondary);line-height:1.6;padding-left:4px">$1</li>'
  );
  // Wrap consecutive li elements
  s = s.replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g,
    m => `<ul style="margin:8px 0;padding-left:20px;list-style-type:disc">${m}</ul>`
  );

  // Step 9: paragraphs — split by double newlines
  const blocks = s.split(/\n\n+/);
  s = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-6]|ul|ol|pre|hr|blockquote)/.test(block) || block.startsWith('\x00CB')) return block;
    return `<p style="font-family:var(--font-inter),system-ui,sans-serif;font-size:13px;color:var(--lp-text-secondary);line-height:1.65;margin:0 0 12px">${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  // Step 10: restore code blocks
  codeBlocks.forEach((block, idx) => {
    s = s.replace(`\x00CB${idx}\x00`, block);
  });

  return s;
}

// ── Requirements panel ────────────────────────────────────────────────────────

export default function RequirementsPanel() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const {
    prdText,
    setPrdText,
    constraints,
    setConstraints,
    stageStatus,
    setStageStatus,
    advanceStage,
    addChatMessage,
    currentProjectId,
  } = useForgeStore();

  const [textareaFocused, setTextareaFocused] = useState(false);
  const [genButtonPulsed, setGenButtonPulsed] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Refs for scroll-position sync between edit and preview
  const editRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollRatioRef = useRef(0);

  const reqStatus = stageStatus.requirements;
  const isDone = reqStatus === 'done';
  const isProcessing = reqStatus === 'processing';

  // Persist demo mode flag in the Zustand store so isDemoActive() stays true
  // after client-side navigation that drops ?demo=true from the URL.
  useEffect(() => {
    if (isDemoActive()) useDemoStore.getState().setDemoMode(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate PRD text in demo mode so the textarea is never blank
  useEffect(() => {
    if (!isDemoActive()) return;
    if (prdText) return; // already has content — don't overwrite
    setPrdText(
      'Build a scalable e-commerce platform with user authentication, product catalog, shopping cart, Stripe payment processing, and an admin dashboard. Expected traffic: 10k daily users.',
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger a single pulse animation when status transitions to done
  const prevDoneRef = useRef(isDone);
  useEffect(() => {
    if (!prevDoneRef.current && isDone) {
      setGenButtonPulsed(true);
      const t = setTimeout(() => setGenButtonPulsed(false), 600);
      prevDoneRef.current = true;
      return () => clearTimeout(t);
    }
    prevDoneRef.current = isDone;
  }, [isDone]);

  function captureScrollRatio(el: HTMLElement | null) {
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    scrollRatioRef.current = max > 0 ? el.scrollTop / max : 0;
  }

  function applyScrollRatio(el: HTMLElement | null) {
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = max * scrollRatioRef.current;
  }

  function togglePreview() {
    if (!previewMode) {
      // Going to preview — capture edit scroll position
      captureScrollRatio(editRef.current);
      setPreviewMode(true);
      setTimeout(() => applyScrollRatio(previewRef.current), 30);
    } else {
      // Going to edit — capture preview scroll position
      captureScrollRatio(previewRef.current);
      setPreviewMode(false);
      setTimeout(() => applyScrollRatio(editRef.current), 30);
    }
  }

  function handleSubmitPrd() {
    if (!prdText.trim()) return;

    if (isDemoActive()) {
      setConstraints([]);
      setStageStatus('requirements', 'processing');

      runDemoRequirements(prdText, (message: ForgeChatMessage) => {
        addChatMessage('requirements', message);
        // Extract constraint chips from agent messages that carry them
        if (message.chips && message.chips.length > 0) {
          const chips: ConstraintChip[] = message.chips.map((c) => ({
            id: c.id,
            label: c.label,
            category: c.category,
          }));
          setConstraints(chips);
        }
      }).then(() => {
        setStageStatus('requirements', 'done');
      }).catch(() => {
        // Demo streaming failed — still complete the stage gracefully
        setStageStatus('requirements', 'done');
      });
      return;
    }

    if (!currentProjectId) return;
    setConstraints([]);
    setStageStatus('requirements', 'locked');
  }

  async function handleGenerateArchitecture() {
    if (!isDone) return;

    if (isDemoActive()) {
      advanceStage();
      router.push(`/app/${id}/architecture?demo=true`);
      return;
    }

    if (!currentProjectId) return;
    // Accept the PRD so architecture_sse gate passes
    try {
      const { authHeaders } = await import('@/lib/forge-agents');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${API_URL}/workflows/prd/v2/accept/${currentProjectId}`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch { /* non-fatal — proceed anyway */ }
    advanceStage();
    router.push(`/app/${id}/architecture`);
  }

  return (
    <main
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 40px',
        background: 'var(--lp-bg)',
        overflow: 'hidden',
      }}
      aria-label="Product Requirements panel"
    >
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Product Requirements
        </h1>

        <AnimatePresence>
          {(isProcessing || isDone) && constraints.length > 0 && (
            <motion.span
              key="constraint-badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--lp-accent)',
                background: 'var(--lp-accent-dim)',
                border: '0.5px solid rgba(45,212,191,0.25)',
                borderRadius: '100px',
                padding: '3px 10px',
              }}
              aria-live="polite"
              aria-label={`${constraints.length} constraints extracted`}
            >
              {constraints.length} constraints extracted
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── PRD box: textarea (edit) or markdown (preview) ───────────────────── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: '200px',
        }}
      >
        {/* Edit/Preview toggle button — top-right of the box */}
        <button
          type="button"
          onClick={togglePreview}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            background: previewMode ? 'var(--lp-accent-dim)' : 'var(--lp-elevated)',
            border: `0.5px solid ${previewMode ? 'rgba(45,212,191,0.3)' : 'var(--lp-border-hover)'}`,
            borderRadius: '6px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '11px',
            fontWeight: 500,
            color: previewMode ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          aria-label={previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
        >
          {previewMode ? (
            <>
              {/* Pencil icon */}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </>
          ) : (
            <>
              {/* Eye icon */}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </>
          )}
        </button>

        {/* Edit mode: raw textarea */}
        {!previewMode && (
          <textarea
            ref={editRef}
            value={prdText}
            onChange={(e) => setPrdText(e.target.value)}
            onFocus={() => setTextareaFocused(true)}
            onBlur={() => setTextareaFocused(false)}
            onScroll={() => captureScrollRatio(editRef.current)}
            aria-label="Product requirements document"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'var(--lp-elevated)',
              border: `0.5px solid ${
                textareaFocused
                  ? 'rgba(45,212,191,0.4)'
                  : 'var(--lp-border-hover)'
              }`,
              borderRadius: '10px',
              padding: '16px',
              paddingTop: '40px',
              fontSize: '14px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              color: 'var(--lp-text-primary)',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.65,
              overflow: 'auto',
              boxSizing: 'border-box',
              transition: 'border-color 150ms ease',
            }}
          />
        )}

        {/* Preview mode: rendered markdown */}
        {previewMode && (
          <div
            ref={previewRef}
            onScroll={() => captureScrollRatio(previewRef.current)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--lp-elevated)',
              border: '0.5px solid var(--lp-border-hover)',
              borderRadius: '10px',
              padding: '16px',
              paddingTop: '44px',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
            aria-label="Product requirements document preview"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: renderMarkdown(prdText) }}
          />
        )}
      </div>

      {/* ── Status hint ──────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          minHeight: '18px',
          flexShrink: 0,
        }}
        aria-live="polite"
      >
        {isProcessing && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            <PulsingDot />
            Agent 1 is extracting NFR constraints…
          </span>
        )}

        {isDone && (
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            {constraints.length} NFR constraint{constraints.length !== 1 ? 's' : ''} extracted
          </span>
        )}
      </div>

      {/* ── Bottom action row ────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Generate Architecture primary button */}
        <motion.button
          type="button"
          onClick={handleGenerateArchitecture}
          disabled={!isDone}
          animate={
            genButtonPulsed
              ? { scale: [1, 1.02, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            padding: '7px 18px',
            background: isDone ? 'var(--lp-accent-dim)' : 'transparent',
            border: `0.5px solid ${
              isDone ? 'rgba(45,212,191,0.3)' : 'var(--lp-border-hover)'
            }`,
            borderRadius: '8px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: isDone ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
            cursor: isDone ? 'pointer' : 'not-allowed',
            opacity: isDone ? 1 : 0.5,
            transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease',
          }}
          aria-disabled={!isDone}
          aria-label="Generate architecture from requirements"
        >
          Generate Architecture →
        </motion.button>
      </div>

      <style>{`
        textarea::placeholder { color: var(--lp-text-hint); }
      `}</style>
    </main>
  );
}
