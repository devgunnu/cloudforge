'use client';

import { useState } from 'react';
import { useDnD } from '@/components/canvas/DnDContext';
import { servicesByCategory, type AWSServiceDefinition } from '@/lib/awsServices';

const CATEGORY_ORDER = [
  'Compute',
  'Storage',
  'Database',
  'Networking',
  'CDN',
  'Security',
  'Cache',
  'Messaging',
];

const CATEGORY_COLORS: Record<string, string> = {
  Compute: 'var(--cf-green)',
  Messaging: 'var(--cf-green)',
  Storage: 'var(--cf-cyan)',
  Database: 'var(--cf-cyan)',
  Security: 'var(--cf-amber)',
  Cache: 'var(--cf-amber)',
  Networking: 'var(--cf-text-muted)',
  CDN: 'var(--cf-text-muted)',
};

function ServiceItem({ service }: { service: AWSServiceDefinition }) {
  const [, setDnDType] = useDnD();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const Icon = service.icon;
  const iconColor = CATEGORY_COLORS[service.category] ?? 'var(--cf-text-muted)';

  return (
    <div
      draggable
      onDragStart={(e) => {
        setDnDType(service.id);
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
      }}
      onDragEnd={() => {
        setIsDragging(false);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        height: '60px',
        padding: '10px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        cursor: 'grab',
        borderLeft: `2px solid ${isHovered ? 'var(--cf-green)' : 'transparent'}`,
        background: isHovered ? 'var(--cf-bg-elevated)' : 'transparent',
        transition: 'all 150ms ease',
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
        userSelect: 'none',
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'var(--cf-bg-elevated)',
          border: '0.5px solid var(--cf-border-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--cf-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {service.label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '11px',
            color: 'var(--cf-text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {service.description}
        </div>
      </div>
    </div>
  );
}

export default function NodePalette() {
  return (
    <div
      style={{
        width: '256px',
        flexShrink: 0,
        background: 'var(--cf-bg-surface)',
        borderRight: '0.5px solid var(--cf-border)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--cf-bg-elevated) transparent',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 8px',
          borderBottom: '0.5px solid var(--cf-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: 'var(--cf-text-muted)',
            letterSpacing: '0.05em',
          }}
        >
          // AWS SERVICES
        </span>
      </div>

      {/* Categories */}
      {CATEGORY_ORDER.map((category) => {
        const services = servicesByCategory[category];
        if (!services || services.length === 0) return null;
        return (
          <div key={category}>
            <div
              style={{
                padding: '16px 16px 6px',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '10px',
                letterSpacing: '0.1em',
                color: 'var(--cf-text-hint)',
                textTransform: 'uppercase',
              }}
            >
              // {category.toUpperCase()}
            </div>
            {services.map((service) => (
              <ServiceItem key={service.id} service={service} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
