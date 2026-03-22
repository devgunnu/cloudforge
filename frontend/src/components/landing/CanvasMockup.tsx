'use client';

import { motion } from 'framer-motion';
import { Zap, Globe, Database } from 'lucide-react';

interface MockNode {
  id: string;
  label: string;
  subtitle: string;
  dotColor: string;
  iconColor: string;
  Icon: typeof Zap;
  x: number;
  y: number;
}

const NODES: MockNode[] = [
  {
    id: 'lambda',
    label: 'api-handler',
    subtitle: 'nodejs20.x · 512mb',
    dotColor: '#00ff87',
    iconColor: '#FF9900',
    Icon: Zap,
    x: 0,
    y: 60,
  },
  {
    id: 'apigw',
    label: 'rest-api',
    subtitle: 'REST · edge',
    dotColor: '#00d4ff',
    iconColor: '#FF4F8B',
    Icon: Globe,
    x: 240,
    y: 0,
  },
  {
    id: 'rds',
    label: 'postgres-db',
    subtitle: 'postgres 15 · t3.micro',
    dotColor: '#00d4ff',
    iconColor: '#527FFF',
    Icon: Database,
    x: 240,
    y: 130,
  },
];

const NODE_W = 180;
const NODE_H = 58;

interface EdgeProps {
  x1: number; y1: number; x2: number; y2: number; delay?: number;
}

function AnimatedEdge({ x1, y1, x2, y2, delay = 0 }: EdgeProps) {
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="rgba(45,212,191,0.45)"
      strokeWidth="1.5"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        pathLength: { duration: 1.1, ease: 'easeInOut', delay },
        opacity: { duration: 0.3, delay },
      }}
    />
  );
}

export default function CanvasMockup() {
  const W = 420;
  const H = 200;

  return (
    /* VIDEO_SLOT: Replace this entire div with a <video> or <iframe> embed */
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        borderRadius: '14px',
        overflow: 'hidden',
        background: 'var(--lp-surface)',
        border: '1px solid var(--lp-border-hover)',
        padding: '24px',
      }}
    >
      {/* Caption */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '14px',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '10px',
          color: 'var(--lp-text-hint)',
          letterSpacing: '0.05em',
        }}
      >
        // live canvas preview
      </div>

      <div style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
        {/* SVG edges */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          viewBox={`0 0 ${W} ${H}`}
        >
          {/* Lambda (right edge) → API GW (left edge) */}
          <AnimatedEdge
            x1={NODES[0].x + NODE_W}
            y1={NODES[0].y + NODE_H / 2}
            x2={NODES[1].x}
            y2={NODES[1].y + NODE_H / 2}
            delay={0.2}
          />
          {/* Lambda (right edge) → RDS (left edge) */}
          <AnimatedEdge
            x1={NODES[0].x + NODE_W}
            y1={NODES[0].y + NODE_H / 2}
            x2={NODES[2].x}
            y2={NODES[2].y + NODE_H / 2}
            delay={0.5}
          />
        </svg>

        {/* Nodes */}
        {NODES.map((node, i) => {
          const Icon = node.Icon;
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.88 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.05 + i * 0.12 }}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: NODE_W,
                background: '#12172b',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '10px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: node.dotColor,
                    flexShrink: 0,
                  }}
                />
                <Icon size={12} style={{ color: node.iconColor, flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#cdd6f4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {node.label}
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '9px',
                  color: '#6c7086',
                  paddingLeft: '14px',
                }}
              >
                {node.subtitle}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
