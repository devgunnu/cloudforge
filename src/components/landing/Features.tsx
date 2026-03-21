import {
  PenTool,
  Cpu,
  Cloud,
  Terminal,
  Share2,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: PenTool,
    iconColor: 'var(--cf-green)',
    title: 'No YAML required',
    description: 'Draw instead of write. Build complex infrastructure diagrams without touching a config file.',
  },
  {
    icon: Cpu,
    iconColor: 'var(--cf-cyan)',
    title: 'Claude-powered IaC',
    description: 'AI generates production-grade Terraform from your visual diagram — reviewed and ready to ship.',
  },
  {
    icon: Cloud,
    iconColor: 'var(--cf-green)',
    title: 'AWS Cloud Control API',
    description: 'Real resources, not simulations. CloudForge provisions actual AWS infrastructure on every deploy.',
  },
  {
    icon: Terminal,
    iconColor: 'var(--cf-cyan)',
    title: 'Live deploy log',
    description: 'Watch provisioning happen in real time with a terminal-style log of every Terraform operation.',
  },
  {
    icon: Share2,
    iconColor: 'var(--cf-green)',
    title: 'Shareable topologies',
    description: 'Export your architecture as a versioned JSON schema — commit it, share it, restore it.',
  },
  {
    icon: Shield,
    iconColor: 'var(--cf-cyan)',
    title: 'Type-safe schema',
    description: 'Every deployment uses a strict CloudForgeTopology contract — no surprises in production.',
  },
];

export default function Features() {
  return (
    <section
      style={{
        padding: '96px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Section label */}
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '11px',
          color: 'var(--cf-text-hint)',
          letterSpacing: '0.1em',
          marginBottom: '48px',
          textAlign: 'center',
        }}
      >
        // FEATURES
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              style={{
                background: 'var(--cf-bg-surface)',
                border: '0.5px solid var(--cf-border)',
                borderRadius: '12px',
                padding: '20px',
                transition: 'border-color 150ms ease, background 150ms ease',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = 'rgba(0,255,135,0.3)';
                el.style.background = 'var(--cf-bg-elevated)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = 'var(--cf-border)';
                el.style.background = 'var(--cf-bg-surface)';
              }}
            >
              <Icon size={20} style={{ color: feature.iconColor, marginBottom: '12px' }} />
              <h3
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--cf-text-primary)',
                  marginBottom: '6px',
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  color: 'var(--cf-text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
