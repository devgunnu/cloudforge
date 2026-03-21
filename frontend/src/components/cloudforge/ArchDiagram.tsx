'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  layer: 'app' | 'infra';
  x: number;
  y: number;
  isNew?: boolean;
  isActive?: boolean;
}

interface ArchEdge {
  from: string;
  to: string;
}

interface ArchDiagramProps {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const NODE_W = 140;
const NODE_H = 56;
const CANVAS_PADDING = 40;

/* ── Component ──────────────────────────────────────────────────────────────── */

export default function ArchDiagram({ nodes, edges }: ArchDiagramProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, ArchNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const ariaLabel = useMemo(() => {
    const nodeLabels = nodes.map((n) => n.label).join(', ');
    const edgePairs = edges
      .map((e) => {
        const fromLabel = nodeMap.get(e.from)?.label ?? e.from;
        const toLabel = nodeMap.get(e.to)?.label ?? e.to;
        return `${fromLabel} → ${toLabel}`;
      })
      .join(', ');
    const nodesPart = nodeLabels ? `Architecture diagram: ${nodeLabels}.` : 'Architecture diagram.';
    const edgesPart = edgePairs ? ` Connections: ${edgePairs}.` : '';
    return `${nodesPart}${edgesPart}`;
  }, [nodes, edges, nodeMap]);

  const layerLabels = useMemo(() => {
    const appNodes = nodes.filter((n) => n.layer === 'app');
    const infraNodes = nodes.filter((n) => n.layer === 'infra');

    const appMinY = appNodes.length > 0 ? Math.min(...appNodes.map((n) => n.y)) : 0;
    const infraMinY = infraNodes.length > 0 ? Math.min(...infraNodes.map((n) => n.y)) : 0;

    return {
      app: { y: appMinY + CANVAS_PADDING - 20 },
      infra: { y: infraMinY + CANVAS_PADDING - 20 },
    };
  }, [nodes]);

  /* Calculate canvas height from node positions */
  const canvasHeight = useMemo(() => {
    if (nodes.length === 0) return 380;
    const maxY = Math.max(...nodes.map((n) => n.y));
    return maxY + CANVAS_PADDING * 2 + NODE_H + 60; /* 60px for legend */
  }, [nodes]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minWidth: '840px',
        minHeight: '380px',
        height: canvasHeight,
        background: 'var(--cf-bg-base)',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* SVG edge layer */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(45,212,191,0.5)" />
          </marker>
        </defs>

        {edges.map((edge, index) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;

          const x1 = fromNode.x + CANVAS_PADDING + NODE_W;
          const y1 = fromNode.y + CANVAS_PADDING + NODE_H / 2;
          const x2 = toNode.x + CANVAS_PADDING;
          const y2 = toNode.y + CANVAS_PADDING + NODE_H / 2;
          const mx = (x1 + x2) / 2;

          const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

          return (
            <motion.path
              key={`${edge.from}-${edge.to}`}
              d={d}
              stroke="rgba(45,212,191,0.4)"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#arrow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 0.8,
                ease: 'easeInOut',
                delay: index * 0.15,
              }}
            />
          );
        })}
      </svg>

      {/* Layer labels */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: CANVAS_PADDING,
          top: layerLabels.app.y,
          fontSize: '9px',
          letterSpacing: '0.1em',
          color: 'var(--lp-text-hint)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        Application Layer
      </span>

      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: CANVAS_PADDING,
          top: layerLabels.infra.y,
          fontSize: '9px',
          letterSpacing: '0.1em',
          color: 'var(--lp-text-hint)',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        Infrastructure Layer
      </span>

      {/* Node layer */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {nodes.map((node) => (
          <ArchNodeCard key={node.id} node={node} />
        ))}
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}

/* ── ArchNodeCard ────────────────────────────────────────────────────────────── */

function ArchNodeCard({ node }: { node: ArchNode }) {
  const isApp = node.layer === 'app';

  const defaultBorder = isApp
    ? '0.5px solid var(--lp-accent-dim)'
    : '0.5px solid var(--cf-purple-glow)';

  const newBorder = node.isNew ? '1px solid var(--lp-accent)' : defaultBorder;
  const newShadow = node.isNew ? '0 0 12px var(--lp-accent-glow)' : 'none';

  const accentBarColor = isApp ? 'var(--lp-accent)' : 'var(--cf-purple)';

  /* Animation props for new / active nodes */
  const animateProps = node.isNew
    ? {
        animate: {
          boxShadow: [
            '0 0 0px var(--lp-accent-glow)',
            '0 0 20px var(--lp-accent-glow)',
            '0 0 0px var(--lp-accent-glow)',
          ],
        },
        transition: { duration: 1.5, repeat: 2, ease: 'easeInOut' as const },
      }
    : node.isActive
      ? {
          animate: {
            borderColor: [
              'rgba(45,212,191,0.2)',
              'rgba(45,212,191,0.6)',
              'rgba(45,212,191,0.2)',
            ],
          },
          transition: { duration: 1.2, repeat: Infinity },
        }
      : {};

  return (
    <motion.div
      {...animateProps}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: 1,
        scale: 1,
        ...(animateProps.animate ?? {}),
      }}
      transition={{
        opacity: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
        scale: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
        ...(animateProps.transition ? { boxShadow: animateProps.transition, borderColor: animateProps.transition } : {}),
      }}
      style={{
        position: 'absolute',
        left: node.x + CANVAS_PADDING,
        top: node.y + CANVAS_PADDING,
        width: NODE_W,
        background: 'var(--cf-bg-surface)',
        border: newBorder,
        borderRadius: '10px',
        padding: '10px 12px',
        boxShadow: newShadow,
        cursor: 'default',
        overflow: 'hidden',
      }}
      whileHover={{
        borderColor: isApp ? 'rgba(45,212,191,0.4)' : 'var(--cf-purple-border)',
        boxShadow: isApp ? '0 0 8px var(--lp-accent-glow)' : 'none',
      }}
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '2px',
          borderRadius: '10px 0 0 10px',
          background: accentBarColor,
        }}
      />

      <span
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--lp-text-primary)',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
        }}
      >
        {node.label}
      </span>

      {node.sublabel && (
        <span
          style={{
            display: 'block',
            fontSize: '10px',
            color: 'var(--lp-text-hint)',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            marginTop: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {node.sublabel}
        </span>
      )}
    </motion.div>
  );
}

/* ── Legend ───────────────────────────────────────────────────────────────────── */

function Legend() {
  const items: { color: string; label: string; glow?: boolean }[] = [
    { color: 'var(--lp-accent)', label: 'Application services' },
    { color: 'var(--cf-purple)', label: 'Infrastructure' },
    { color: 'var(--lp-accent)', label: 'Newly added', glow: true },
  ];

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '10px 16px',
        borderTop: '0.5px solid var(--cf-border)',
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '2px',
              borderRadius: '1px',
              background: item.color,
              flexShrink: 0,
              boxShadow: item.glow
                ? `0 0 6px ${item.color}`
                : 'none',
            }}
          />
          <span
            style={{
              fontSize: '10px',
              color: 'var(--lp-text-hint)',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
