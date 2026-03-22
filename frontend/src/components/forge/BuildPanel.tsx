'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode2 } from 'lucide-react';
import { useForgeStore } from '@/store/forgeStore';
import { runAgent3 } from '@/lib/forge-agents';
import ArchDiagram, { convertForgeNodes, convertForgeEdges } from '@/components/cloudforge/ArchDiagram';
import type { GeneratedFile, ForgeArchNode } from '@/store/forgeStore';

// ── Syntax tokenizer ──────────────────────────────────────────────────────────

function tokenizeLine(content: string, lang: string): React.ReactNode {
  if (!content.trim()) {
    return <span style={{ color: 'var(--lp-text-primary)' }}>{content}</span>;
  }

  if (lang === 'hcl' || lang === 'terraform') {
    if (/^\s*(#|\/\/)/.test(content)) {
      return <span style={{ color: '#6c7086' }}>{content}</span>;
    }
    const segments: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;
    const hclKeywordRe = /\b(resource|provider|terraform|output|variable|module|data|locals|backend|required_providers|required_version)\b/;
    const accentRe = /(?:resource|module)\s+"[^"]*"\s+"([^"]+)"/;
    const accentMatch = accentRe.exec(content);
    const accentName = accentMatch ? accentMatch[1] : null;
    let i = 0;
    const chars = content;
    let buf = '';
    while (i < chars.length) {
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
        let strContent = '"';
        i++;
        while (i < chars.length && chars[i] !== '"') { strContent += chars[i]; i++; }
        strContent += '"';
        i++;
        const innerVal = strContent.slice(1, -1);
        if (accentName && innerVal === accentName) {
          segments.push(<span key={key++} style={{ color: 'var(--lp-accent)' }}>{strContent}</span>);
        } else {
          segments.push(<span key={key++} style={{ color: '#34d399' }}>{strContent}</span>);
        }
      } else { buf += chars[i]; i++; }
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

  if (lang === 'typescript' || lang === 'javascript' || lang === 'ts' || lang === 'js') {
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
        const typeRe = /:\s*[A-Z][A-Za-z<>\[\]|&]+/g;
        let last = 0;
        let tm: RegExpExecArray | null;
        let typed = false;
        while ((tm = typeRe.exec(buf)) !== null) {
          typed = true;
          if (tm.index > last) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf.slice(last, tm.index)}</span>);
          segments.push(<span key={key++} style={{ color: '#f59e0b' }}>{tm[0]}</span>);
          last = tm.index + tm[0].length;
        }
        if (typed && last < buf.length) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf.slice(last)}</span>);
        else if (!typed) segments.push(<span key={key++} style={{ color: 'var(--lp-text-primary)' }}>{buf}</span>);
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
          if (chars[i] === '\\') { strContent += chars[i]; i++; }
          if (i < chars.length) { strContent += chars[i]; i++; }
        }
        strContent += quote;
        i++;
        segments.push(<span key={key++} style={{ color: '#34d399' }}>{strContent}</span>);
      } else { buf += chars[i]; i++; }
    }
    flushBuf();
    return <>{segments}</>;
  }

  return <span style={{ color: 'var(--lp-text-primary)' }}>{content}</span>;
}

// ── Copy to clipboard helper ──────────────────────────────────────────────────

function getFileContent(file: GeneratedFile): string {
  return file.lines.map((l) => l.content).join('\n');
}

// ── View tab bar ──────────────────────────────────────────────────────────────

type BuildView = 'files' | 'architecture';

function ViewTabBar({
  active,
  onChange,
}: {
  active: BuildView;
  onChange: (v: BuildView) => void;
}) {
  const tabs: { id: BuildView; label: string }[] = [
    { id: 'files',        label: 'Files' },
    { id: 'architecture', label: 'Architecture' },
  ];

  return (
    <div
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 16px',
        borderBottom: '0.5px solid var(--lp-border)',
        background: 'var(--lp-surface)',
        flexShrink: 0,
      }}
      role="tablist"
      aria-label="Build view"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
              background: isActive ? 'var(--lp-accent-dim)' : 'transparent',
              transition: 'all 150ms ease',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Node inspector for Build — includes "View code" button ────────────────────

const VALIDATES_CHIP_COLORS: Record<ForgeArchNode['type'], string> = {
  gateway: 'rgba(45,212,191,0.15)',
  compute: 'rgba(45,212,191,0.15)',
  cache: 'rgba(245,158,11,0.15)',
  storage: 'rgba(52,211,153,0.15)',
  auth: 'rgba(167,139,250,0.15)',
  queue: 'rgba(45,212,191,0.12)',
};

interface BuildNodeInspectorProps {
  node: ForgeArchNode | null;
  associatedFile: { id: string; name: string } | null;
  onClose: () => void;
  onViewCode: (fileId: string) => void;
}

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 14, borderBottom: '0.5px solid var(--lp-border)', marginBottom: 14 }}>
      <p style={{
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: 10, fontWeight: 600,
        color: 'var(--lp-text-hint)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        margin: '0 0 8px',
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function BuildNodeInspector({ node, associatedFile, onClose, onViewCode }: BuildNodeInspectorProps) {
  return (
    <motion.aside
      animate={{ width: node ? 280 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      style={{
        overflow: 'hidden',
        height: '100%',
        flexShrink: 0,
        borderLeft: '0.5px solid var(--lp-border)',
        background: 'var(--lp-surface)',
        position: 'relative',
      }}
      aria-label="Node inspector"
    >
      {node && (
        <div style={{ width: 280, height: '100%', overflow: 'auto', padding: 20, boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 14, fontWeight: 600,
              color: 'var(--lp-text-primary)',
              margin: 0, lineHeight: 1.3,
            }}>
              {node.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              style={{
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--lp-text-secondary)',
                fontSize: 16, lineHeight: 1,
                padding: '2px 4px', borderRadius: 4,
                flexShrink: 0, marginLeft: 8,
              }}
            >
              ×
            </button>
          </div>

          {/* View associated code file — primary CTA */}
          <motion.button
            type="button"
            onClick={() => associatedFile && onViewCode(associatedFile.id)}
            disabled={!associatedFile}
            whileHover={associatedFile ? { scale: 1.02 } : {}}
            whileTap={associatedFile ? { scale: 0.98 } : {}}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              marginBottom: 18,
              background: associatedFile ? 'var(--lp-accent-dim)' : 'var(--lp-elevated)',
              border: `0.5px solid ${associatedFile ? 'rgba(45,212,191,0.35)' : 'var(--lp-border)'}`,
              borderRadius: 8,
              cursor: associatedFile ? 'pointer' : 'default',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 11,
              color: associatedFile ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
              textAlign: 'left',
            }}
            aria-label={associatedFile ? `View ${associatedFile.name}` : 'No associated code file'}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>⌘</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {associatedFile ? `View ${associatedFile.name}` : 'No dedicated code file'}
            </span>
            {associatedFile && <span style={{ flexShrink: 0 }}>→</span>}
          </motion.button>

          {/* Terraform resource */}
          <InspectorRow label="Terraform resource">
            <code style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 11, color: 'var(--lp-accent)',
              background: 'var(--lp-elevated)',
              border: '0.5px solid var(--lp-border)',
              borderRadius: 5, padding: '4px 8px',
              display: 'block', wordBreak: 'break-all',
            }}>
              {node.terraformResource}
            </code>
          </InspectorRow>

          {/* Estimated cost */}
          <InspectorRow label="Est. cost">
            <span style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 12, color: 'var(--lp-text-primary)',
            }}>
              {node.estimatedCost}
            </span>
          </InspectorRow>

          {/* Config */}
          <InspectorRow label="Config">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Object.entries(node.config).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--lp-text-secondary)', flexShrink: 0 }}>{key}:</span>
                  <span style={{
                    color: 'var(--lp-text-primary)',
                    background: 'var(--lp-elevated)',
                    border: '0.5px solid var(--lp-border)',
                    borderRadius: 5, padding: '2px 6px',
                    minWidth: 0, wordBreak: 'break-all',
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </InspectorRow>

          {/* Why chosen */}
          <InspectorRow label="Why chosen">
            <p style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 12, color: 'var(--lp-text-secondary)',
              lineHeight: 1.5, margin: 0,
            }}>
              {node.whyChosen}
            </p>
          </InspectorRow>

          {/* Validates */}
          <div>
            <p style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 10, fontWeight: 600,
              color: 'var(--lp-text-hint)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              margin: '0 0 8px',
            }}>
              Validates
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {node.validates.map((constraint) => (
                <span
                  key={constraint}
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: 10, fontWeight: 500,
                    color: 'rgba(52,211,153,0.9)',
                    background: VALIDATES_CHIP_COLORS[node.type],
                    border: '0.5px solid rgba(52,211,153,0.2)',
                    borderRadius: 100, padding: '2px 8px',
                  }}
                >
                  {constraint}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}

// ── Architecture view ─────────────────────────────────────────────────────────

interface ArchViewProps {
  archNodes: ForgeArchNode[];
  archEdges: Array<{ from: string; to: string }>;
  generatedFiles: Record<string, GeneratedFile>;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onViewCode: (fileId: string) => void;
}

function ArchView({ archNodes, archEdges, generatedFiles, selectedNodeId, onNodeSelect, onViewCode }: ArchViewProps) {
  const selectedNode = selectedNodeId
    ? archNodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  // Find the most relevant associated file for the selected node
  const findAssociatedFile = (nodeId: string): { id: string; name: string } | null => {
    const allFiles = Object.values(generatedFiles);
    // Prefer a dedicated code file (non-main.tf) for the node
    const dedicated = allFiles.find((f) => f.nodeId === nodeId && f.name !== 'main.tf');
    if (dedicated) return { id: dedicated.id, name: dedicated.name };
    // Fall back to any file with matching nodeId
    const any = allFiles.find((f) => f.nodeId === nodeId);
    if (any) return { id: any.id, name: any.name };
    // Last resort: stack definition (main.tf)
    const mainFile = allFiles.find((f) => f.name === 'main.tf');
    return mainFile ? { id: mainFile.id, name: mainFile.name } : null;
  };

  const associatedFile = selectedNode ? findAssociatedFile(selectedNode.id) : null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header hint */}
        <p style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: 12,
          color: 'var(--lp-text-hint)',
          margin: 0, flexShrink: 0,
        }}>
          Click any resource to inspect its config and view the associated code file.
        </p>

        {/* Diagram */}
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
          <ArchDiagram
            nodes={convertForgeNodes(archNodes)}
            edges={convertForgeEdges(archEdges)}
            onNodeSelect={onNodeSelect}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </div>

      {/* Node inspector */}
      <BuildNodeInspector
        node={selectedNode}
        associatedFile={associatedFile}
        onClose={() => onNodeSelect(null)}
        onViewCode={onViewCode}
      />
    </div>
  );
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
    currentProjectId,
    updateFileContent,
    markDirty,
    markClean,
    saveFile,
    dirtyFiles,
  } = useForgeStore();

  const [activeView, setActiveView] = useState<BuildView>('files');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const agentRan = useRef(false);
  const activityFilesRef = useRef<Array<{ id: string; name: string; status: 'new' | 'modified' | 'pending' }>>([]);

  const buildStatus = stageStatus.build;

  const archNodes = architectureData?.nodes ?? [];
  const archEdges = architectureData?.edges ?? [];

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

  const handleViewCode = useCallback((fileId: string) => {
    openFile(fileId);
    setActiveView('files');
    setSelectedNodeId(null);
  }, [openFile]);

  const handleSave = useCallback(async () => {
    if (!activeFile || !currentProjectId) return;
    setSaveStatus('saving');
    const ok = await saveFile(currentProjectId, activeFile);
    if (ok) {
      markClean(activeFile);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
    }
  }, [activeFile, currentProjectId, saveFile, markClean]);

  useEffect(() => {
    if (agentRan.current) return;
    if (buildStatus !== 'processing' && buildStatus !== 'locked') return;

    agentRan.current = true;

    addChatMessage('build', {
      id: `agent3-start-${Date.now()}`,
      role: 'agent',
      content: 'Agent 3 is generating Terraform and application code from your architecture…',
    });

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

    const archData = architectureData ?? { nodes: [], edges: [] };

    runAgent3(archData, {
      onFileReady: (file: GeneratedFile) => {
        addGeneratedFile(file);
        activityFilesRef.current = [
          ...activityFilesRef.current,
          { id: file.id, name: file.name, status: file.status },
        ];
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
    }, currentProjectId ?? undefined).then(() => {
      setStageStatus('build', 'done');
      setBuildProgress(buildTotal, buildTotal);
      // Auto-open all generated files so the Files view is populated
      const allFiles = Object.values(useForgeStore.getState().generatedFiles);
      allFiles.forEach((f) => openFile(f.id));
      addChatMessage('build', {
        id: `agent3-done-${Date.now()}`,
        role: 'agent',
        content: 'Build complete. 5 files generated. Deploy button is now unlocked.',
      });
    }).catch(() => {
      addChatMessage('build', {
        id: `agent3-error-${Date.now()}`,
        role: 'agent',
        content: 'Code generation failed. Please try again.',
      });
      agentRan.current = false;
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
      aria-label="Build panel"
    >
      {/* ── Progress bar (during generation) ──────────────────────────────── */}
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
            <motion.span
              aria-hidden="true"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{
                display: 'inline-block',
                width: 8, height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: 12, color: 'var(--lp-text-secondary)', flexShrink: 0 }}>
              Agent 3 generating code
            </span>
            <div
              style={{ background: 'var(--lp-elevated)', borderRadius: 100, height: 4, width: 160, flexShrink: 0, overflow: 'hidden' }}
              role="progressbar"
              aria-valuenow={buildProgress}
              aria-valuemin={0}
              aria-valuemax={buildTotal}
            >
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ height: '100%', background: 'var(--lp-accent)', borderRadius: 100 }}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 11, color: 'var(--lp-text-hint)', flexShrink: 0 }}>
              {buildProgress} / {buildTotal} files
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Global view tab bar ────────────────────────────────────────────── */}
      <ViewTabBar active={activeView} onChange={setActiveView} />

      {/* ── Architecture view ──────────────────────────────────────────────── */}
      {activeView === 'architecture' && (
        <ArchView
          archNodes={archNodes}
          archEdges={archEdges}
          generatedFiles={generatedFiles}
          selectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
          onViewCode={handleViewCode}
        />
      )}

      {/* ── Files view ─────────────────────────────────────────────────────── */}
      {activeView === 'files' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* File editor tab bar */}
          <div
            style={{
              height: 36,
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
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFile(id); }
                    }}
                    onClick={() => { openFile(id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '0 12px', height: '100%',
                      cursor: 'pointer', flexShrink: 0,
                      background: isActive ? 'var(--lp-elevated)' : 'transparent',
                      borderBottom: isActive ? '1.5px solid var(--lp-accent)' : '1.5px solid transparent',
                      borderRight: '0.5px solid var(--lp-border)',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: 12,
                      color: isActive ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
                      whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {file.name}
                      {dirtyFiles[id] && (
                        <span
                          title="Unsaved changes"
                          style={{
                            display: 'inline-block', width: 6, height: 6,
                            borderRadius: '50%', background: '#f59e0b',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </span>
                    {dirtyFiles[id] && (
                      <span
                        aria-label="Unsaved changes"
                        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lp-accent)', flexShrink: 0 }}
                      />
                    )}
                    <button
                      type="button"
                      aria-label={`Close ${file.name}`}
                      onClick={(e) => { e.stopPropagation(); closeFile(id); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 14, height: 14,
                        background: 'transparent', border: 'none',
                        borderRadius: 3, cursor: 'pointer',
                        padding: 0, color: 'var(--lp-text-hint)',
                        fontSize: 12, lineHeight: 1, flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Code editor or empty state */}
          {openFiles.length === 0 || !activeFileData ? (
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}
              aria-label="No file selected"
            >
              <FileCode2 size={32} aria-hidden="true" style={{ color: 'var(--lp-text-hint)', opacity: 0.3 }} />
              <p style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 13, color: 'var(--lp-text-secondary)',
                textAlign: 'center', maxWidth: 280,
                margin: 0, lineHeight: 1.55,
              }}>
                Click a file in the chat cards, or switch to{' '}
                <button
                  type="button"
                  onClick={() => setActiveView('architecture')}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--lp-accent)', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 'inherit',
                    padding: 0, textDecoration: 'underline',
                  }}
                >
                  Architecture view
                </button>
                {' '}and click a resource to view its code.
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Action buttons */}
              <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={`Copy ${activeFileData.name} to clipboard`}
                  style={{
                    background: 'var(--lp-elevated)',
                    border: '0.5px solid var(--lp-border-hover)',
                    borderRadius: 6, padding: '4px 10px',
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: 11, color: 'var(--lp-text-secondary)', cursor: 'pointer',
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
                    borderRadius: 6, padding: '4px 10px',
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: 11, color: 'var(--lp-text-secondary)', cursor: 'pointer',
                  }}
                >
                  ↓ Download
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  aria-label={`Save ${activeFileData.name}`}
                  style={{
                    background: dirtyFiles[activeFile!] ? 'var(--lp-accent-dim)' : 'var(--lp-elevated)',
                    border: `0.5px solid ${dirtyFiles[activeFile!] ? 'rgba(45,212,191,0.4)' : 'var(--lp-border-hover)'}`,
                    borderRadius: 6, padding: '4px 10px',
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: 11,
                    color: dirtyFiles[activeFile!] ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
                    cursor: saveStatus === 'saving' ? 'wait' : 'pointer',
                  }}
                >
                  {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓ Saved' : '↑ Save'}
                </button>
              </div>

              {/* Code editor — editable textarea with syntax font */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {/* Line numbers */}
                <div
                  style={{
                    width: 44, flexShrink: 0,
                    background: 'var(--lp-surface)',
                    borderRight: '0.5px solid var(--lp-border)',
                    padding: '12px 0',
                    overflowY: 'hidden',
                  }}
                  aria-hidden="true"
                >
                  {activeFileData.lines.map((_, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'block', textAlign: 'right',
                        paddingRight: 12, fontSize: 12,
                        color: 'var(--lp-text-hint)', lineHeight: 1.6,
                        userSelect: 'none',
                      }}
                    >
                      {idx + 1}
                    </span>
                  ))}
                </div>
                {/* Editable textarea */}
                <textarea
                  value={activeFileData.lines.map((l) => l.content).join('\n')}
                  onChange={(e) => {
                    updateFileContent(activeFile!, e.target.value);
                    markDirty(activeFile!);
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  spellCheck={false}
                  aria-label={`Edit ${activeFileData.name}`}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--lp-text-primary)',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 12,
                    lineHeight: 1.6,
                    padding: '12px 16px',
                    overflowY: 'auto',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
