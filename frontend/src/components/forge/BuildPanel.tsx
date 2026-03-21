'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode2 } from 'lucide-react';
import { useForgeStore } from '@/store/forgeStore';
import { runAgent3 } from '@/lib/forge-agents';
import type { GeneratedFile } from '@/store/forgeStore';

// ── Syntax tokenizer ──────────────────────────────────────────────────────────

function tokenizeLine(content: string, lang: string): React.ReactNode {
  if (!content.trim()) {
    return <span style={{ color: 'var(--lp-text-primary)' }}>{content}</span>;
  }

  if (lang === 'hcl' || lang === 'terraform') {
    // Comments
    if (/^\s*(#|\/\/)/.test(content)) {
      return <span style={{ color: '#6c7086' }}>{content}</span>;
    }

    // Tokenize HCL inline
    const segments: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    const hclKeywordRe = /\b(resource|provider|terraform|output|variable|module|data|locals|backend|required_providers|required_version)\b/;
    const stringRe = /"([^"]*)"/g;
    const accentRe = /(?:resource|module)\s+"[^"]*"\s+"([^"]+)"/;

    // Check for accent identifier (resource/module second label)
    const accentMatch = accentRe.exec(content);
    const accentName = accentMatch ? accentMatch[1] : null;

    // Build token list by scanning
    let i = 0;
    const chars = content;
    let buf = '';

    while (i < chars.length) {
      // String literal
      if (chars[i] === '"') {
        if (buf) {
          const kwMatch = hclKeywordRe.exec(buf);
          if (kwMatch) {
            const before = buf.slice(0, kwMatch.index);
            const kw = kwMatch[0];
            const after = buf.slice(kwMatch.index + kw.length);
            if (before) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{before}</span>);
            segments.push(<span key={key++} style={{ color: '#f59e0b' }}>{kw}</span>);
            if (after) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{after}</span>);
          } else {
            segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf}</span>);
          }
          buf = '';
        }
        // Collect string including closing quote
        let strContent = '"';
        i++;
        while (i < chars.length && chars[i] !== '"') {
          strContent += chars[i];
          i++;
        }
        strContent += '"';
        i++;
        // Check if this string value matches the accent name
        const innerVal = strContent.slice(1, -1);
        if (accentName && innerVal === accentName) {
          segments.push(<span key={key++} style={{ color: 'var(--lp-accent)' }}>{strContent}</span>);
        } else {
          segments.push(<span key={key++} style={{ color: '#34d399' }}>{strContent}</span>);
        }
      } else {
        buf += chars[i];
        i++;
      }
    }

    if (buf) {
      const kwMatch = hclKeywordRe.exec(buf);
      if (kwMatch) {
        const before = buf.slice(0, kwMatch.index);
        const kw = kwMatch[0];
        const after = buf.slice(kwMatch.index + kw.length);
        if (before) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{before}</span>);
        segments.push(<span key={key++} style={{ color: '#f59e0b' }}>{kw}</span>);
        if (after) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{after}</span>);
      } else {
        segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf}</span>);
      }
    }

    return <>{segments}</>;
  }

  // TypeScript / JavaScript
  if (lang === 'typescript' || lang === 'javascript' || lang === 'ts' || lang === 'js') {
    // Comments
    if (/^\s*(\/\/|\/\*)/.test(content)) {
      return <span style={{ color: '#6c7086' }}>{content}</span>;
    }

    const segments: React.ReactNode[] = [];
    let key = 0;
    let i = 0;
    const chars = content;
    let buf = '';

    const tsKeywordRe = /\b(import|export|async|await|const|let|var|function|return|if|else|from|type|interface|class|extends|implements|new|typeof|keyof|readonly|default|as|of|for|while|try|catch|finally|throw|in)\b/;

    const flushBuf = () => {
      if (!buf) return;
      const kwMatch = tsKeywordRe.exec(buf);
      if (kwMatch) {
        const before = buf.slice(0, kwMatch.index);
        const kw = kwMatch[0];
        const after = buf.slice(kwMatch.index + kw.length);
        if (before) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{before}</span>);
        segments.push(<span key={key++} style={{ color: '#a78bfa' }}>{kw}</span>);
        if (after) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{after}</span>);
      } else {
        // Check for type annotation pattern (: TypeName)
        const typeRe = /:\s*[A-Z][A-Za-z<>\[\]|&]+/g;
        let last = 0;
        let tm: RegExpExecArray | null;
        let typed = false;
        while ((tm = typeRe.exec(buf)) !== null) {
          typed = true;
          if (tm.index > last) {
            segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf.slice(last, tm.index)}</span>);
          }
          segments.push(<span key={key++} style={{ color: '#f59e0b' }}>{tm[0]}</span>);
          last = tm.index + tm[0].length;
        }
        if (typed && last < buf.length) {
          segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf.slice(last)}</span>);
        } else if (!typed) {
          segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf}</span>);
        }
      }
      buf = '';
    };

    while (i < chars.length) {
      if (chars[i] === '"' || chars[i] === "'" || chars[i] === '`') {
        flushBuf();
        const quote = chars[i];
        let strContent = quote;
        i++;
        while (i < chars.length && chars[i] !== quote) {
          if (chars[i] === '\\') {
            strContent += chars[i];
            i++;
          }
          if (i < chars.length) {
            strContent += chars[i];
            i++;
          }
        }
        strContent += quote;
        i++;
        segments.push(<span key={key++} style={{ color: '#34d399' }}>{strContent}</span>);
      } else {
        buf += chars[i];
        i++;
      }
    }
    flushBuf();

    return <>{segments}</>;
  }

  // Fallback
  return <span style={{ color: 'var(--lp-text-primary)' }}>{content}</span>;
}

// ── Copy to clipboard helper ──────────────────────────────────────────────────

function getFileContent(file: GeneratedFile): string {
  return file.lines.map((l) => l.content).join('\n');
}

// ── BuildPanel ────────────────────────────────────────────────────────────────

export default function BuildPanel() {
  const {
    stageStatus,
    architectureData,
    generatedFiles,
    openFiles,
    activeFile,
    buildProgress,
    buildTotal,
    addChatMessage,
    addGeneratedFile,
    setBuildProgress,
    setStageStatus,
    openFile,
    closeFile,
  } = useForgeStore();

  const agentRan = useRef(false);
  const activityFilesRef = useRef<Array<{ id: string; name: string; status: 'new' | 'modified' | 'pending' }>>([]);

  const buildStatus = stageStatus.build;

  const handleCopy = useCallback(() => {
    if (!activeFile) return;
    const file = generatedFiles[activeFile];
    if (!file) return;
    navigator.clipboard.writeText(getFileContent(file)).catch(() => undefined);
  }, [activeFile, generatedFiles]);

  const handleDownload = useCallback(() => {
    if (!activeFile) return;
    const file = generatedFiles[activeFile];
    if (!file) return;
    const blob = new Blob([getFileContent(file)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeFile, generatedFiles]);

  useEffect(() => {
    if (agentRan.current) return;
    if (buildStatus !== 'processing') return;
    if (!architectureData) return;

    agentRan.current = true;

    // Initial chat message
    addChatMessage('build', {
      id: `agent3-start-${Date.now()}`,
      role: 'agent',
      content: 'Agent 3 is generating Terraform and application code from your architecture…',
    });

    // Initial activity card message
    addChatMessage('build', {
      id: `agent3-activity-${Date.now()}`,
      role: 'agent',
      content: '',
      activityCard: {
        status: 'processing',
        label: '⟳ Generating code files',
        files: [],
      },
    });

    runAgent3(architectureData, {
      onFileReady: (file: GeneratedFile) => {
        addGeneratedFile(file);

        activityFilesRef.current = [
          ...activityFilesRef.current,
          { id: file.id, name: file.name, status: file.status },
        ];

        // Chat message per completed file
        addChatMessage('build', {
          id: `agent3-file-${file.id}-${Date.now()}`,
          role: 'agent',
          content: '',
          activityCard: {
            status: 'done',
            label: `✓ ${file.name} generated`,
            files: [{ id: file.id, name: file.name, status: file.status }],
          },
        });
      },
      onProgress: (filesComplete: number, total: number) => {
        setBuildProgress(filesComplete, total);
      },
    }).then(() => {
      setStageStatus('build', 'done');
      setBuildProgress(buildTotal, buildTotal);
      addChatMessage('build', {
        id: `agent3-done-${Date.now()}`,
        role: 'agent',
        content: 'Build complete. 5 files generated. Deploy button is now unlocked.',
      });
    });
  }, [
    buildStatus,
    architectureData,
    addChatMessage,
    addGeneratedFile,
    setBuildProgress,
    setStageStatus,
    buildTotal,
  ]);

  const isDone = buildProgress >= buildTotal && buildTotal > 0 && buildStatus === 'done';
  const pct = buildTotal > 0 ? (buildProgress / buildTotal) * 100 : 0;

  const activeFileData = activeFile ? generatedFiles[activeFile] : null;

  return (
    <main
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--lp-bg)',
        overflow: 'hidden',
      }}
      aria-label="Build panel — code editor"
    >
      {/* ── Section 1: Agent progress bar ─────────────────────────────────── */}
      <AnimatePresence>
        {!isDone && (
          <motion.div
            key="progress-bar-strip"
            initial={{ opacity: 1, height: 40 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeInOut' }}
            style={{
              height: 40,
              background: 'var(--lp-surface)',
              borderBottom: '0.5px solid var(--lp-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 16px',
              flexShrink: 0,
              overflow: 'hidden',
            }}
            aria-live="polite"
            aria-label={`Generating files: ${buildProgress} of ${buildTotal}`}
          >
            {/* Spinning amber dot */}
            <motion.span
              aria-hidden="true"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f59e0b',
                flexShrink: 0,
              }}
            />

            {/* Label */}
            <span
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '12px',
                color: 'var(--lp-text-secondary)',
                flexShrink: 0,
              }}
            >
              Agent 3 generating code
            </span>

            {/* Progress bar track */}
            <div
              style={{
                background: 'var(--lp-elevated)',
                borderRadius: '100px',
                height: '4px',
                width: '160px',
                flexShrink: 0,
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={buildProgress}
              aria-valuemin={0}
              aria-valuemax={buildTotal}
            >
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  background: 'var(--lp-accent)',
                  borderRadius: '100px',
                }}
              />
            </div>

            {/* File count */}
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-text-hint)',
                flexShrink: 0,
              }}
            >
              {buildProgress} / {buildTotal} files
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 2: Editor tab bar ──────────────────────────────────────── */}
      <div
        style={{
          height: '36px',
          display: 'flex',
          alignItems: 'stretch',
          borderBottom: '0.5px solid var(--lp-border)',
          background: 'var(--lp-surface)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
        role="tablist"
        aria-label="Open files"
      >
        <AnimatePresence initial={false}>
          {openFiles.map((id) => {
            const file = generatedFiles[id];
            if (!file) return null;
            const isActive = id === activeFile;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFile(id);
                  }
                }}
                onClick={() => openFile(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  height: '100%',
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: isActive ? 'var(--lp-elevated)' : 'transparent',
                  borderBottom: isActive
                    ? '1.5px solid var(--lp-accent)'
                    : '1.5px solid transparent',
                  borderRight: '0.5px solid var(--lp-border)',
                  userSelect: 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: '12px',
                    color: isActive
                      ? 'var(--lp-text-primary)'
                      : 'var(--lp-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </span>
                <button
                  type="button"
                  aria-label={`Close ${file.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--lp-text-hint)',
                    fontSize: '12px',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Section 3: Editor or empty state ──────────────────────────────── */}
      {openFiles.length === 0 || !activeFileData ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
          aria-label="No file selected"
        >
          <FileCode2
            size={32}
            aria-hidden="true"
            style={{
              color: 'var(--lp-text-hint)',
              opacity: 0.3,
            }}
          />
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--lp-text-secondary)',
              textAlign: 'center',
              maxWidth: '280px',
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            Click a file in the chat cards or Files tab to view the generated
            code
          </p>
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Action buttons */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 5,
              display: 'flex',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy ${activeFileData.name} to clipboard`}
              style={{
                background: 'var(--lp-elevated)',
                border: '0.5px solid var(--lp-border-hover)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '11px',
                color: 'var(--lp-text-secondary)',
                cursor: 'pointer',
              }}
            >
              ⎘ Copy
            </button>
            <button
              type="button"
              onClick={handleDownload}
              aria-label={`Download ${activeFileData.name}`}
              style={{
                background: 'var(--lp-elevated)',
                border: '0.5px solid var(--lp-border-hover)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '11px',
                color: 'var(--lp-text-secondary)',
                cursor: 'pointer',
              }}
            >
              ↓ Download
            </button>
          </div>

          {/* Code view */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            {/* Line numbers */}
            <div
              style={{
                width: '44px',
                flexShrink: 0,
                background: 'var(--lp-surface)',
                borderRight: '0.5px solid var(--lp-border)',
                padding: '12px 0',
              }}
              aria-hidden="true"
            >
              {activeFileData.lines.map((_, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'block',
                    textAlign: 'right',
                    paddingRight: '12px',
                    fontSize: '12px',
                    color: 'var(--lp-text-hint)',
                    lineHeight: 1.6,
                    userSelect: 'none',
                  }}
                >
                  {idx + 1}
                </span>
              ))}
            </div>

            {/* Code column */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '12px 0',
              }}
            >
              {activeFileData.lines.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    background: line.highlight
                      ? 'rgba(52,211,153,0.05)'
                      : 'transparent',
                    borderLeft: line.highlight
                      ? '2px solid rgba(52,211,153,0.5)'
                      : '2px solid transparent',
                    paddingLeft: '16px',
                    paddingRight: '48px',
                    whiteSpace: 'pre',
                  }}
                >
                  {tokenizeLine(line.content, activeFileData.lang)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
