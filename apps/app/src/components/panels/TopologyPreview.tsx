'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/store/canvasStore';
import { syntaxHighlight } from '@/lib/utils';

export default function TopologyPreview() {
  const getTopology = useCanvasStore((s) => s.getTopology);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const [highlighted, setHighlighted] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const topology = getTopology();
    const json = JSON.stringify(topology, null, 2);
    setHighlighted(syntaxHighlight(json));
  }, [nodes, edges, getTopology]);

  const handleCopy = () => {
    const topology = getTopology();
    void navigator.clipboard.writeText(JSON.stringify(topology, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        height: '176px',
        background: 'var(--cf-bg-base)',
        borderTop: '0.5px solid var(--cf-border)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '36px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '0.5px solid var(--cf-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: 'var(--cf-text-muted)',
          }}
        >
          {'{ }'} topology.json
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: 'none',
            border: '0.5px solid var(--cf-border-hover)',
            borderRadius: '4px',
            padding: '3px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '10px',
            color: copied ? 'var(--cf-green)' : 'var(--cf-text-muted)',
            transition: 'color 150ms ease',
          }}
        >
          {copied ? '✓ Copied' : 'Copy JSON'}
        </button>
      </div>

      {/* JSON content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--cf-bg-elevated) transparent',
        }}
      >
        <pre
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            margin: 0,
          }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    </motion.div>
  );
}
