'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface FileNode {
  name: string;
  type: 'file' | 'dir';
  status?: 'done' | 'writing' | 'pending';
  category?: 'infra' | 'src' | 'config';
  children?: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
}

export default function FileTree({ nodes }: FileTreeProps) {
  return (
    <div
      style={{
        padding: '12px 8px',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '12px',
      }}
      role="tree"
      aria-label="Project files"
    >
      {nodes.map((node) => (
        <TreeNode key={node.name} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === 'dir') {
    return (
      <div role="treeitem" aria-expanded={expanded} aria-label={node.name}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            height: '26px',
            paddingLeft: `${depth * 16}px`,
            paddingRight: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            width: '100%',
            borderRadius: '6px',
            color: 'var(--lp-text-secondary)',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          <ChevronRight
            size={12}
            aria-hidden
            style={{
              flexShrink: 0,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
              color: 'var(--lp-text-hint)',
            }}
          />
          <span>{node.name}</span>
        </button>

        {expanded && node.children && (
          <div role="group">
            {node.children.map((child) => (
              <TreeNode key={child.name} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="treeitem"
      aria-label={`${node.name} - ${node.status ?? 'pending'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '26px',
        paddingLeft: `${(depth + 1) * 16}px`,
        paddingRight: '8px',
        borderRadius: '6px',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--lp-border)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <StatusDot status={node.status} />
      <span style={{ color: getFileColor(node.status, node.category) }}>
        {node.name}
      </span>
      {node.status === 'writing' && (
        <span className="animate-pulse" style={{ color: getFileColor('writing', node.category) }}>
          ···
        </span>
      )}
      {node.status === 'done' && (
        <span style={{ color: 'var(--lp-accent)', fontSize: '10px' }}>
          ✓
        </span>
      )}
    </div>
  );
}

function StatusDot({ status }: { status?: 'done' | 'writing' | 'pending' }) {
  const colorMap: Record<string, string> = {
    done: 'var(--lp-accent)',
    writing: 'var(--cf-purple)',
    pending: 'var(--lp-text-hint)',
  };
  const color = colorMap[status ?? 'pending'];

  return (
    <span
      aria-hidden
      className={status === 'writing' ? 'animate-pulse' : undefined}
      style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function getFileColor(
  status?: 'done' | 'writing' | 'pending',
  category?: 'infra' | 'src' | 'config'
): string {
  if (status === 'done') return 'var(--lp-text-secondary)';
  if (status === 'pending') return 'var(--lp-text-hint)';

  // writing state: color by category
  if (category === 'infra') return 'var(--cf-purple)';
  if (category === 'src') return 'var(--lp-accent)';
  if (category === 'config') return 'var(--cf-amber)';

  return 'var(--lp-text-secondary)';
}
