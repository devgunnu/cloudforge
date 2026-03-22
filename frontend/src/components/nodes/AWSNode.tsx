'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import { awsServices, getCategoryColor, getNodeSubtitle } from '@/lib/awsServices';
import { useCanvasStore } from '@/store/canvasStore';

interface AWSNodeData {
  serviceId: string;
  label: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

function AWSNode({ id, data, selected }: NodeProps) {
  const nodeData = data as AWSNodeData;
  const { serviceId, label, config } = nodeData;
  const service = awsServices[serviceId];
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode);

  if (!service) return null;

  const Icon = service.icon;
  const dotColor = getCategoryColor(service.category);
  const subtitle = getNodeSubtitle(serviceId, config);

  return (
    <div
      className="group"
      style={{
        background: 'var(--cf-bg-surface)',
        border: selected
          ? '0.5px solid var(--cf-green)'
          : '0.5px solid var(--cf-border)',
        borderRadius: '10px',
        minWidth: '200px',
        padding: '12px 14px',
        transition: 'border-color 150ms ease',
        boxShadow: selected
          ? '0 0 0 1px rgba(0,255,135,0.15)'
          : '0 2px 8px rgba(0,0,0,0.4)',
        position: 'relative',
      }}
    >
      {/* Left target handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--cf-bg-elevated)',
          border: '1.5px solid var(--cf-cyan)',
          opacity: 0,
          transition: 'opacity 150ms ease',
        }}
        className="group-hover:!opacity-100"
      />

      {/* Right source handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--cf-bg-elevated)',
          border: '1.5px solid var(--cf-cyan)',
          opacity: 0,
          transition: 'opacity 150ms ease',
        }}
        className="group-hover:!opacity-100"
      />

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />

        {/* Icon */}
        <Icon
          size={14}
          style={{ color: service.color, flexShrink: 0 }}
        />

        {/* Label */}
        <span
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--cf-text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>

        {/* Delete button */}
        <button
          className="nodrag"
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--cf-text-hint)',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--cf-red)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--cf-text-hint)';
          }}
          aria-label={`Delete ${label}`}
        >
          <X size={13} />
        </button>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '10px',
            color: 'var(--cf-text-muted)',
            marginBottom: '8px',
            paddingLeft: '16px',
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          height: '1px',
          background: 'var(--cf-border)',
          marginBottom: '8px',
        }}
      />

      {/* Configure button */}
      <button
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedNode(id);
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '10px',
          color: 'var(--cf-cyan)',
          padding: '0',
          textDecoration: 'none',
          transition: 'text-decoration 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none';
        }}
      >
        Configure ›
      </button>
    </div>
  );
}

export default memo(AWSNode);
