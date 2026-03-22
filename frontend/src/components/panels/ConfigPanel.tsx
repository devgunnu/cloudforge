'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { awsServices } from '@/lib/awsServices';

interface FieldProps {
  label: string;
  value: string | number | boolean;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
}

function Field({ label, value, onChange, type = 'text', options }: FieldProps) {
  const inputStyle = {
    width: '100%',
    background: 'var(--cf-bg-base)',
    border: '0.5px solid var(--cf-border-hover)',
    borderRadius: '6px',
    padding: '8px 10px',
    color: 'var(--cf-text-primary)',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 150ms ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          color: 'var(--cf-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </label>
      {type === 'boolean' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onChange(String(!value))}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '10px',
              border: 'none',
              background: value ? 'var(--cf-green)' : 'var(--cf-bg-elevated)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 150ms ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: value ? '18px' : '2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'white',
                transition: 'left 150ms ease',
              }}
            />
          </button>
          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px', color: 'var(--cf-text-muted)' }}>
            {value ? 'enabled' : 'disabled'}
          </span>
        </div>
      ) : type === 'select' && options ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle,
            cursor: 'pointer',
            appearance: 'none' as const,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cf-green)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--cf-border-hover)'; }}
        >
          {options.map((opt) => (
            <option key={opt} value={opt} style={{ background: 'var(--cf-bg-base)' }}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cf-green)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--cf-border-hover)'; }}
        />
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '10px',
        letterSpacing: '0.1em',
        color: 'var(--cf-text-hint)',
        marginTop: '16px',
        marginBottom: '8px',
      }}
    >
      // {label.toUpperCase()}
    </div>
  );
}

interface ServiceConfigFieldsProps {
  serviceId: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function ServiceConfigFields({ serviceId, config, onChange }: ServiceConfigFieldsProps) {
  switch (serviceId) {
    case 'lambda':
      return (
        <>
          <SectionHeader label="function" />
          <Field label="Name" value={String(config.name ?? '')} onChange={(v) => onChange('name', v)} />
          <Field label="Runtime" value={String(config.runtime ?? '')} onChange={(v) => onChange('runtime', v)} type="select" options={['nodejs20.x', 'nodejs18.x', 'python3.12', 'python3.11', 'java21', 'go1.x']} />
          <Field label="Handler" value={String(config.handler ?? '')} onChange={(v) => onChange('handler', v)} />
          <SectionHeader label="resources" />
          <Field label="Memory (MB)" value={Number(config.memory ?? 128)} onChange={(v) => onChange('memory', Number(v))} type="number" />
          <Field label="Timeout (s)" value={Number(config.timeout ?? 30)} onChange={(v) => onChange('timeout', Number(v))} type="number" />
        </>
      );
    case 'api-gateway':
      return (
        <>
          <SectionHeader label="api" />
          <Field label="Name" value={String(config.name ?? '')} onChange={(v) => onChange('name', v)} />
          <Field label="Stage" value={String(config.stage ?? '')} onChange={(v) => onChange('stage', v)} />
          <Field label="Type" value={String(config.type ?? '')} onChange={(v) => onChange('type', v)} type="select" options={['REST', 'HTTP', 'WebSocket']} />
          <SectionHeader label="throttling" />
          <Field label="Rate Limit" value={Number(config.throttlingRateLimit ?? 10000)} onChange={(v) => onChange('throttlingRateLimit', Number(v))} type="number" />
          <Field label="Burst Limit" value={Number(config.throttlingBurstLimit ?? 5000)} onChange={(v) => onChange('throttlingBurstLimit', Number(v))} type="number" />
        </>
      );
    case 's3':
      return (
        <>
          <SectionHeader label="bucket" />
          <Field label="Bucket Name" value={String(config.bucketName ?? '')} onChange={(v) => onChange('bucketName', v)} />
          <Field label="Region" value={String(config.region ?? 'us-east-1')} onChange={(v) => onChange('region', v)} type="select" options={['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']} />
          <Field label="Encryption" value={String(config.encryption ?? 'AES256')} onChange={(v) => onChange('encryption', v)} type="select" options={['AES256', 'aws:kms']} />
          <SectionHeader label="access" />
          <Field label="Versioning" value={Boolean(config.versioning)} onChange={(v) => onChange('versioning', v === 'true')} type="boolean" />
          <Field label="Public Access" value={Boolean(config.publicAccess)} onChange={(v) => onChange('publicAccess', v === 'true')} type="boolean" />
        </>
      );
    case 'rds':
      return (
        <>
          <SectionHeader label="database" />
          <Field label="Identifier" value={String(config.identifier ?? '')} onChange={(v) => onChange('identifier', v)} />
          <Field label="Engine" value={String(config.engine ?? 'postgres')} onChange={(v) => onChange('engine', v)} type="select" options={['postgres', 'mysql', 'mariadb', 'aurora-postgresql', 'aurora-mysql']} />
          <Field label="Engine Version" value={String(config.engineVersion ?? '15')} onChange={(v) => onChange('engineVersion', v)} />
          <Field label="Instance Class" value={String(config.instanceClass ?? 'db.t3.micro')} onChange={(v) => onChange('instanceClass', v)} type="select" options={['db.t3.micro', 'db.t3.small', 'db.t3.medium', 'db.r6g.large']} />
          <SectionHeader label="storage" />
          <Field label="Storage (GB)" value={Number(config.storageGb ?? 20)} onChange={(v) => onChange('storageGb', Number(v))} type="number" />
          <Field label="Multi-AZ" value={Boolean(config.multiAz)} onChange={(v) => onChange('multiAz', v === 'true')} type="boolean" />
        </>
      );
    case 'ec2':
      return (
        <>
          <SectionHeader label="instance" />
          <Field label="Instance Type" value={String(config.instanceType ?? 't3.micro')} onChange={(v) => onChange('instanceType', v)} type="select" options={['t3.micro', 't3.small', 't3.medium', 't3.large', 'm6i.large', 'c6i.large']} />
          <Field label="Key Pair" value={String(config.keyPair ?? '')} onChange={(v) => onChange('keyPair', v)} />
          <Field label="Storage (GB)" value={Number(config.storageGb ?? 8)} onChange={(v) => onChange('storageGb', Number(v))} type="number" />
          <SectionHeader label="network" />
          <Field label="Public IP" value={Boolean(config.publicIp)} onChange={(v) => onChange('publicIp', v === 'true')} type="boolean" />
        </>
      );
    case 'vpc':
      return (
        <>
          <SectionHeader label="network" />
          <Field label="CIDR Block" value={String(config.cidr ?? '10.0.0.0/16')} onChange={(v) => onChange('cidr', v)} />
          <Field label="Region" value={String(config.region ?? 'us-east-1')} onChange={(v) => onChange('region', v)} type="select" options={['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']} />
          <SectionHeader label="dns" />
          <Field label="DNS Support" value={Boolean(config.enableDnsSupport)} onChange={(v) => onChange('enableDnsSupport', v === 'true')} type="boolean" />
          <Field label="DNS Hostnames" value={Boolean(config.enableDnsHostnames)} onChange={(v) => onChange('enableDnsHostnames', v === 'true')} type="boolean" />
        </>
      );
    case 'iam-role':
      return (
        <>
          <SectionHeader label="role" />
          <Field label="Role Name" value={String(config.roleName ?? '')} onChange={(v) => onChange('roleName', v)} />
          <Field label="Trusted Service" value={String(config.trustedService ?? '')} onChange={(v) => onChange('trustedService', v)} type="select" options={['lambda.amazonaws.com', 'ec2.amazonaws.com', 'ecs-tasks.amazonaws.com', 'apigateway.amazonaws.com']} />
        </>
      );
    case 'elasticache':
      return (
        <>
          <SectionHeader label="cache" />
          <Field label="Engine" value={String(config.engine ?? 'redis')} onChange={(v) => onChange('engine', v)} type="select" options={['redis', 'memcached']} />
          <Field label="Node Type" value={String(config.nodeType ?? 'cache.t3.micro')} onChange={(v) => onChange('nodeType', v)} type="select" options={['cache.t3.micro', 'cache.t3.small', 'cache.t3.medium', 'cache.r6g.large']} />
          <Field label="Num Nodes" value={Number(config.numNodes ?? 1)} onChange={(v) => onChange('numNodes', Number(v))} type="number" />
          <Field label="Port" value={Number(config.port ?? 6379)} onChange={(v) => onChange('port', Number(v))} type="number" />
        </>
      );
    case 'cloudfront':
      return (
        <>
          <SectionHeader label="distribution" />
          <Field label="Price Class" value={String(config.priceClass ?? 'PriceClass_100')} onChange={(v) => onChange('priceClass', v)} type="select" options={['PriceClass_100', 'PriceClass_200', 'PriceClass_All']} />
          <Field label="HTTP Version" value={String(config.httpVersion ?? 'http2')} onChange={(v) => onChange('httpVersion', v)} type="select" options={['http2', 'http2and3', 'http1.1']} />
          <Field label="IPv6" value={Boolean(config.ipv6)} onChange={(v) => onChange('ipv6', v === 'true')} type="boolean" />
        </>
      );
    case 'sns':
      return (
        <>
          <SectionHeader label="topic" />
          <Field label="Topic Name" value={String(config.topicName ?? '')} onChange={(v) => onChange('topicName', v)} />
          <Field label="FIFO" value={Boolean(config.fifo)} onChange={(v) => onChange('fifo', v === 'true')} type="boolean" />
          <Field label="Content Deduplication" value={Boolean(config.contentDedup)} onChange={(v) => onChange('contentDedup', v === 'true')} type="boolean" />
        </>
      );
    default:
      return null;
  }
}

export default function ConfigPanel({ nodeId }: { nodeId: string }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useCanvasStore((s) => s.updateNodeLabel);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const data = node.data as { serviceId: string; label: string; config: Record<string, unknown> };
  const service = awsServices[data.serviceId];
  if (!service) return null;

  const Icon = service.icon;

  const handleConfigChange = (key: string, value: unknown) => {
    updateNodeConfig(nodeId, { [key]: value });
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '320px',
        background: 'var(--cf-bg-surface)',
        borderLeft: '0.5px solid var(--cf-border)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '0.5px solid var(--cf-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--cf-bg-elevated)',
            border: '0.5px solid var(--cf-border-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} style={{ color: service.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--cf-text-primary)' }}>
            {service.label}
          </div>
          <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '10px', color: 'var(--cf-text-muted)' }}>
            {service.category}
          </div>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--cf-text-hint)',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--cf-text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--cf-text-hint)'; }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable fields */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--cf-bg-elevated) transparent',
        }}
      >
        {/* Label field */}
        <SectionHeader label="display" />
        <Field
          label="Node Label"
          value={data.label}
          onChange={(v) => updateNodeLabel(nodeId, v)}
        />

        {/* Service-specific fields */}
        <ServiceConfigFields
          serviceId={data.serviceId}
          config={data.config}
          onChange={handleConfigChange}
        />
      </div>

      {/* Footer comment */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '0.5px solid var(--cf-border)',
          flexShrink: 0,
        }}
      >
        {/* ============================================================
            BACKEND HOOK: Config validation
            Future: validate config against AWS service quotas + pricing
            Show estimated monthly cost per resource here
            ============================================================ */}
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '10px',
            color: 'var(--cf-text-hint)',
            lineHeight: '1.5',
          }}
        >
          // config syncs live to topology
        </div>
      </div>
    </motion.div>
  );
}
