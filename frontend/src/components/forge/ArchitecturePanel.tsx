'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForgeStore } from '@/store/forgeStore';
import ArchDiagram, { convertForgeNodes, convertForgeEdges } from '@/components/cloudforge/ArchDiagram';
import {
  runAgent2,
  AGENT2_STEPS,
} from '@/lib/forge-agents';
import type { ForgeArchNode } from '@/store/forgeStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALTERNATIVES = [
  {
    name: 'DynamoDB',
    reason:
      'High read latency at P95 for complex user queries — rejected in favor of RDS Postgres',
  },
  {
    name: 'ECS Fargate',
    reason:
      'Cold start overhead from container spin-up exceeds the 200ms P95 NFR — Lambda arm64 chosen',
  },
];

const VALIDATES_CHIP_COLORS: Record<ForgeArchNode['type'], string> = {
  gateway: 'rgba(45,212,191,0.15)',
  compute: 'rgba(45,212,191,0.15)',
  cache: 'rgba(245,158,11,0.15)',
  storage: 'rgba(52,211,153,0.15)',
  auth: 'rgba(167,139,250,0.15)',
  queue: 'rgba(45,212,191,0.12)',
};

// ── Processing overlay step list ──────────────────────────────────────────────

function StepDot({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <span
        aria-hidden="true"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--lp-accent)',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  if (state === 'active') {
    return (
      <motion.span
        aria-hidden="true"
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'rgba(245,158,11,0.9)',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: 'var(--lp-text-hint)',
        flexShrink: 0,
        display: 'block',
      }}
    />
  );
}


// ── Service config schema ─────────────────────────────────────────────────────

type FieldType = 'select' | 'number' | 'toggle' | 'text';

interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  min?: number;
  max?: number;
  default: string;
}

const SERVICE_CONFIG_SCHEMA: Record<string, ConfigField[]> = {
  lambda: [
    { key: 'runtime', label: 'Runtime', type: 'select', options: ['nodejs20.x', 'nodejs18.x', 'python3.12', 'python3.11', 'java21', 'go1.x', 'dotnet8'], default: 'nodejs20.x' },
    { key: 'memory', label: 'Memory', type: 'select', options: ['128', '256', '512', '1024', '2048', '3008', '4096', '10240'], unit: 'MB', default: '256' },
    { key: 'timeout', label: 'Timeout', type: 'number', unit: 's', min: 1, max: 900, default: '30' },
    { key: 'arch', label: 'Architecture', type: 'select', options: ['x86_64', 'arm64'], default: 'arm64' },
    { key: 'concurrency', label: 'Reserved concurrency', type: 'number', min: 0, max: 1000, default: '-1' },
  ],
  s3: [
    { key: 'storage_class', label: 'Storage class', type: 'select', options: ['STANDARD', 'INTELLIGENT_TIERING', 'STANDARD_IA', 'ONEZONE_IA', 'GLACIER', 'DEEP_ARCHIVE'], default: 'STANDARD' },
    { key: 'versioning', label: 'Versioning', type: 'toggle', default: 'true' },
    { key: 'encryption', label: 'Encryption', type: 'select', options: ['SSE-S3', 'SSE-KMS', 'SSE-C'], default: 'SSE-S3' },
    { key: 'public_access', label: 'Block public access', type: 'toggle', default: 'true' },
    { key: 'lifecycle', label: 'Lifecycle rules', type: 'toggle', default: 'false' },
  ],
  apigateway: [
    { key: 'type', label: 'API type', type: 'select', options: ['REST', 'HTTP', 'WebSocket'], default: 'REST' },
    { key: 'auth', label: 'Authorizer', type: 'select', options: ['None', 'Cognito User Pool', 'IAM', 'Lambda', 'API Key'], default: 'Cognito User Pool' },
    { key: 'stage', label: 'Stage name', type: 'text', default: 'prod' },
    { key: 'throttle_rate', label: 'Throttle rate', type: 'number', unit: 'req/s', min: 1, max: 10000, default: '1000' },
    { key: 'throttle_burst', label: 'Burst limit', type: 'number', min: 1, max: 5000, default: '2000' },
    { key: 'cors', label: 'CORS enabled', type: 'toggle', default: 'true' },
  ],
  dynamodb: [
    { key: 'billing_mode', label: 'Billing mode', type: 'select', options: ['PAY_PER_REQUEST', 'PROVISIONED'], default: 'PAY_PER_REQUEST' },
    { key: 'rcu', label: 'Read capacity', type: 'number', unit: 'RCU', min: 1, max: 40000, default: '5' },
    { key: 'wcu', label: 'Write capacity', type: 'number', unit: 'WCU', min: 1, max: 40000, default: '5' },
    { key: 'ttl', label: 'TTL enabled', type: 'toggle', default: 'true' },
    { key: 'streams', label: 'DynamoDB Streams', type: 'toggle', default: 'false' },
    { key: 'pitr', label: 'Point-in-time recovery', type: 'toggle', default: 'true' },
    { key: 'encryption', label: 'Encryption', type: 'select', options: ['AWS_OWNED_KMS', 'CUSTOMER_MANAGED_KMS'], default: 'AWS_OWNED_KMS' },
  ],
  rds: [
    { key: 'engine', label: 'Engine', type: 'select', options: ['postgres', 'mysql', 'aurora-postgresql', 'aurora-mysql', 'mariadb'], default: 'postgres' },
    { key: 'engine_version', label: 'Version', type: 'text', default: '16.2' },
    { key: 'instance_class', label: 'Instance class', type: 'select', options: ['db.t3.micro', 'db.t3.small', 'db.t3.medium', 'db.t3.large', 'db.r6g.large', 'db.r6g.xlarge', 'db.r6g.2xlarge'], default: 'db.t3.medium' },
    { key: 'storage_gb', label: 'Storage', type: 'number', unit: 'GB', min: 20, max: 65536, default: '100' },
    { key: 'multi_az', label: 'Multi-AZ', type: 'toggle', default: 'true' },
    { key: 'backup_days', label: 'Backup retention', type: 'number', unit: 'days', min: 0, max: 35, default: '7' },
    { key: 'deletion_protection', label: 'Deletion protection', type: 'toggle', default: 'true' },
  ],
  cloudfront: [
    { key: 'price_class', label: 'Price class', type: 'select', options: ['PriceClass_All', 'PriceClass_200', 'PriceClass_100'], default: 'PriceClass_All' },
    { key: 'https_only', label: 'HTTPS only', type: 'toggle', default: 'true' },
    { key: 'waf', label: 'WAF enabled', type: 'toggle', default: 'true' },
    { key: 'cache_policy', label: 'Cache policy', type: 'select', options: ['CachingOptimized', 'CachingDisabled', 'CachingOptimizedForUncompressedObjects'], default: 'CachingOptimized' },
    { key: 'compress', label: 'Compress objects', type: 'toggle', default: 'true' },
    { key: 'ipv6', label: 'IPv6 enabled', type: 'toggle', default: 'true' },
  ],
  sqs: [
    { key: 'type', label: 'Queue type', type: 'select', options: ['Standard', 'FIFO'], default: 'Standard' },
    { key: 'visibility_timeout', label: 'Visibility timeout', type: 'number', unit: 's', min: 0, max: 43200, default: '30' },
    { key: 'retention_days', label: 'Message retention', type: 'number', unit: 'days', min: 1, max: 14, default: '4' },
    { key: 'max_message_kb', label: 'Max message size', type: 'number', unit: 'KB', min: 1, max: 256, default: '256' },
    { key: 'dlq', label: 'Dead-letter queue', type: 'toggle', default: 'true' },
    { key: 'encryption', label: 'Encryption (SSE)', type: 'toggle', default: 'true' },
  ],
  sns: [
    { key: 'type', label: 'Topic type', type: 'select', options: ['Standard', 'FIFO'], default: 'Standard' },
    { key: 'encryption', label: 'SSE-KMS encryption', type: 'toggle', default: 'true' },
    { key: 'delivery_retry', label: 'Delivery retry policy', type: 'toggle', default: 'true' },
    { key: 'subscriptions', label: 'Subscriptions', type: 'text', default: 'SQS, Lambda, Email' },
  ],
  ecs: [
    { key: 'launch_type', label: 'Launch type', type: 'select', options: ['FARGATE', 'EC2'], default: 'FARGATE' },
    { key: 'cpu', label: 'Task CPU', type: 'select', options: ['256', '512', '1024', '2048', '4096', '8192', '16384'], unit: 'units', default: '1024' },
    { key: 'memory', label: 'Task memory', type: 'select', options: ['512', '1024', '2048', '4096', '8192', '16384', '30720'], unit: 'MB', default: '2048' },
    { key: 'desired_count', label: 'Desired count', type: 'number', min: 0, max: 1000, default: '2' },
    { key: 'auto_scaling', label: 'Auto scaling', type: 'toggle', default: 'true' },
    { key: 'load_balancer', label: 'Load balancer', type: 'toggle', default: 'true' },
  ],
  cognito: [
    { key: 'mfa', label: 'MFA', type: 'select', options: ['OFF', 'OPTIONAL', 'REQUIRED'], default: 'OPTIONAL' },
    { key: 'password_min_length', label: 'Min password length', type: 'number', min: 6, max: 99, default: '8' },
    { key: 'oauth_providers', label: 'OAuth providers', type: 'text', default: 'Google, GitHub' },
    { key: 'token_expiry_hours', label: 'Token expiry', type: 'number', unit: 'hours', min: 1, max: 24, default: '1' },
    { key: 'email_verification', label: 'Email verification', type: 'toggle', default: 'true' },
    { key: 'advanced_security', label: 'Advanced security', type: 'toggle', default: 'false' },
  ],
  generic: [
    { key: 'region', label: 'Region', type: 'select', options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'], default: 'us-east-1' },
    { key: 'tags', label: 'Tags', type: 'text', default: 'env=prod' },
  ],
};

const SERVICE_COLOR: Record<string, string> = {
  lambda: '#FF9900',
  s3: '#3F8624',
  apigateway: '#8C4FFF',
  dynamodb: '#4053D6',
  rds: '#3F8624',
  cloudfront: '#FF9900',
  sqs: '#FF4F8B',
  sns: '#FF4F8B',
  ecs: '#FF9900',
  cognito: '#DD3522',
  generic: '#545B64',
};

function getSchemaKey(node: ForgeArchNode): string {
  const tfMap: Record<string, string> = {
    aws_lambda_function: 'lambda',
    aws_s3_bucket: 's3',
    aws_api_gateway_rest_api: 'apigateway',
    aws_apigatewayv2_api: 'apigateway',
    aws_dynamodb_table: 'dynamodb',
    aws_db_instance: 'rds',
    aws_rds_cluster: 'rds',
    aws_cloudfront_distribution: 'cloudfront',
    aws_sqs_queue: 'sqs',
    aws_sns_topic: 'sns',
    aws_ecs_service: 'ecs',
    aws_ecs_cluster: 'ecs',
    aws_cognito_user_pool: 'cognito',
  };
  const typeMap: Record<string, string> = {
    compute: 'lambda',
    storage: 's3',
    gateway: 'apigateway',
    queue: 'sqs',
    auth: 'cognito',
    cache: 'generic',
  };
  return tfMap[node.terraformResource] ?? typeMap[node.type] ?? 'generic';
}

// ── Toggle field ──────────────────────────────────────────────────────────────

function ToggleField({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: value ? 'var(--lp-accent)' : 'var(--lp-border)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s',
          display: 'block',
        }}
      />
    </button>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'var(--lp-elevated)',
  border: '0.5px solid var(--lp-border)',
  borderRadius: 5,
  color: 'var(--lp-text-primary)',
  fontSize: 12,
  padding: '5px 8px',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
};

// ── Node inspector panel ──────────────────────────────────────────────────────

interface NodeInspectorProps {
  node: ForgeArchNode | null;
  onClose: () => void;
}

function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const updateNodeConfig = useForgeStore((s) => s.updateNodeConfig);
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!node) return;
    const schemaKey = getSchemaKey(node);
    const fields = SERVICE_CONFIG_SCHEMA[schemaKey] ?? SERVICE_CONFIG_SCHEMA.generic;
    const merged: Record<string, string> = {};
    for (const field of fields) {
      merged[field.key] = node.config[field.key] ?? field.default;
    }
    setLocalConfig(merged);
  }, [node?.id]);

  function handleChange(key: string, value: string) {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    if (node) updateNodeConfig(node.id, { [key]: value });
  }

  if (!node) {
    return (
      <motion.aside
        animate={{ width: 0 }}
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
      />
    );
  }

  const schemaKey = getSchemaKey(node);
  const fields = SERVICE_CONFIG_SCHEMA[schemaKey] ?? SERVICE_CONFIG_SCHEMA.generic;
  const accentColor = SERVICE_COLOR[schemaKey] ?? SERVICE_COLOR.generic;

  return (
    <motion.aside
      animate={{ width: node ? 320 : 0 }}
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
      <div
        style={{
          width: 320,
          height: '100%',
          overflow: 'auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Colored header strip */}
        <div
          style={{
            background: `${accentColor}18`,
            borderBottom: `1px solid ${accentColor}30`,
            padding: '14px 16px 12px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: accentColor,
                  flexShrink: 0,
                  display: 'block',
                }}
              />
              <h2
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--lp-text-primary)',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {node.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--lp-text-secondary)',
                fontSize: '16px',
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Terraform resource badge */}
          <code
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '10px',
              color: accentColor,
              background: `${accentColor}14`,
              border: `0.5px solid ${accentColor}35`,
              borderRadius: 5,
              padding: '3px 8px',
              display: 'inline-block',
              wordBreak: 'break-all',
              maxWidth: '100%',
            }}
          >
            {node.terraformResource}
          </code>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Estimated cost */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '0.5px solid var(--lp-border)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--lp-text-hint)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              Est. cost
            </span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 12,
                color: 'var(--lp-text-primary)',
              }}
            >
              {node.estimatedCost}
            </span>
          </div>

          {/* Editable config fields */}
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--lp-text-hint)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              margin: '0 0 10px 0',
            }}
          >
            Configuration
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {fields.map((field) => {
              const val = localConfig[field.key] ?? field.default;

              if (field.type === 'toggle') {
                return (
                  <div
                    key={field.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-inter), system-ui, sans-serif',
                        fontSize: 12,
                        color: 'var(--lp-text-secondary)',
                        flexShrink: 1,
                        minWidth: 0,
                      }}
                    >
                      {field.label}
                    </span>
                    <ToggleField
                      value={val === 'true'}
                      onChange={(v) => handleChange(field.key, v ? 'true' : 'false')}
                    />
                  </div>
                );
              }

              return (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: 11,
                      color: 'var(--lp-text-secondary)',
                    }}
                  >
                    {field.label}
                    {field.unit && (
                      <span style={{ color: 'var(--lp-text-hint)', marginLeft: 4 }}>
                        ({field.unit})
                      </span>
                    )}
                  </label>

                  {field.type === 'select' && (
                    <div style={{ position: 'relative' }}>
                      <select
                        value={val}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        onFocus={() => setFocusedKey(field.key)}
                        onBlur={() => setFocusedKey(null)}
                        style={{
                          ...inputBase,
                          borderColor: focusedKey === field.key ? 'var(--lp-accent)' : 'var(--lp-border)',
                          cursor: 'pointer',
                          paddingRight: 24,
                        }}
                      >
                        {field.options!.map((opt) => (
                          <option key={opt} value={opt} style={{ background: 'var(--lp-elevated)' }}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          pointerEvents: 'none',
                          fontSize: 9,
                          color: 'var(--lp-text-hint)',
                        }}
                      >
                        ▾
                      </span>
                    </div>
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={val}
                      min={field.min}
                      max={field.max}
                      step={1}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      onFocus={() => setFocusedKey(field.key)}
                      onBlur={() => setFocusedKey(null)}
                      style={{
                        ...inputBase,
                        borderColor: focusedKey === field.key ? 'var(--lp-accent)' : 'var(--lp-border)',
                      }}
                    />
                  )}

                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      onFocus={() => setFocusedKey(field.key)}
                      onBlur={() => setFocusedKey(null)}
                      style={{
                        ...inputBase,
                        borderColor: focusedKey === field.key ? 'var(--lp-accent)' : 'var(--lp-border)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: '0.5px solid var(--lp-border)',
              marginBottom: 14,
            }}
          />

          {/* Why chosen */}
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--lp-text-hint)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              margin: '0 0 8px 0',
            }}
          >
            Why chosen
          </p>
          <div
            style={{
              background: 'var(--lp-elevated)',
              border: '0.5px solid var(--lp-border)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 12,
                fontStyle: 'italic',
                color: 'var(--lp-text-secondary)',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {node.whyChosen}
            </p>
          </div>

          {/* Validates */}
          {node.validates.length > 0 && (
            <>
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--lp-text-hint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  margin: '0 0 8px 0',
                }}
              >
                Validates
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {node.validates.map((constraint) => (
                  <span
                    key={constraint}
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'rgba(52,211,153,0.9)',
                      background: VALIDATES_CHIP_COLORS[node.type],
                      border: '0.5px solid rgba(52,211,153,0.2)',
                      borderRadius: 100,
                      padding: '2px 8px',
                    }}
                  >
                    {constraint}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArchitecturePanel() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const {
    constraints,
    architectureData,
    setArchitectureData,
    stageStatus,
    setStageStatus,
    addChatMessage,
    advanceStage,
    currentProjectId,
  } = useForgeStore();

  const [activeStep, setActiveStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const agentRan = useRef(false);

  // Run Agent 2 only when explicitly triggered ('processing').
  // 'locked' means not yet started — hydration will set it to 'done' if data exists.
  useEffect(() => {
    if (agentRan.current) return;
    if (stageStatus.architecture !== 'processing') return;

    agentRan.current = true;

    addChatMessage('architecture', {
      id: `agent2-start-${Date.now()}`,
      role: 'agent',
      content:
        'Traversing the knowledge graph to find the optimal architecture for your constraints…',
    });

    setProcessing(true);
    setActiveStep(0);

    runAgent2(constraints, (step) => {
      setActiveStep(step);
    }, currentProjectId ?? undefined).then((data) => {
      setArchitectureData(data);
      setStageStatus('architecture', 'done');
      setProcessing(false);
      addChatMessage('architecture', {
        id: `agent2-done-${Date.now()}`,
        role: 'agent',
        content:
          'Architecture validated. 2 alternatives considered and rejected. Proceed to Build when ready.',
      });
    }).catch(() => {
      setProcessing(false);
      addChatMessage('architecture', {
        id: `agent2-error-${Date.now()}`,
        role: 'agent',
        content: 'Architecture generation failed. Please try again.',
      });
      agentRan.current = false;
    });
  }, [stageStatus.architecture, constraints, addChatMessage, setArchitectureData, setStageStatus]);

  const isDone = stageStatus.architecture === 'done';

  const selectedNode =
    selectedNodeId != null
      ? (architectureData?.nodes ?? []).find(
          (n) => n.id === selectedNodeId,
        ) ?? null
      : null;

  const handleNodeClick = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  async function handleContinueToBuild() {
    if (!currentProjectId) return;
    try {
      const { authHeaders } = await import('@/lib/forge-agents');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${API_URL}/workflows/architecture/v2/accept/${currentProjectId}`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch { /* non-fatal — proceed anyway */ }
    advanceStage();
    router.push(`/app/${id}/build`);
  }

  const displayNodes = architectureData?.nodes ?? [];
  const displayEdges = architectureData?.edges ?? [];

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: 'var(--lp-bg)',
        position: 'relative',
      }}
      aria-label="Architecture panel"
    >
      {/* ── Main canvas area ──────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 36px 28px 36px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* ── Header row ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--lp-text-secondary)',
            }}
          >
            Architecture
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AnimatePresence mode="wait">
              {processing && (
                <motion.span
                  key="processing-badge"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'rgba(245,158,11,0.9)',
                    background: 'rgba(245,158,11,0.08)',
                    border: '0.5px solid rgba(245,158,11,0.25)',
                    borderRadius: '100px',
                    padding: '3px 10px',
                  }}
                >
                  Processing…
                </motion.span>
              )}

              {isDone && (
                <motion.div
                  key="done-badges"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', gap: '6px' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--lp-text-secondary)',
                      background: 'var(--lp-elevated)',
                      border: '0.5px solid var(--lp-border-hover)',
                      borderRadius: '100px',
                      padding: '3px 10px',
                    }}
                  >
                    2 alternatives
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'rgba(52,211,153,0.9)',
                      background: 'rgba(52,211,153,0.08)',
                      border: '0.5px solid rgba(52,211,153,0.2)',
                      borderRadius: '100px',
                      padding: '3px 10px',
                    }}
                  >
                    Validated ✓
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Diagram container ───────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 300,
            overflow: 'hidden',
          }}
          aria-label="Architecture diagram"
        >
          {/* Processing overlay — absolute, covers only the canvas */}
          <AnimatePresence>
            {processing && (
              <motion.div
                key="processing-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  background: 'rgba(13,15,19,0.92)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                }}
                aria-live="polite"
                aria-label="Agent 2 is processing"
              >
                {/* Spinner */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '2px solid rgba(45,212,191,0.15)',
                    borderTopColor: 'var(--lp-accent)',
                    marginBottom: '16px',
                  }}
                  aria-hidden="true"
                />

                <p
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--lp-text-primary)',
                    margin: '0 0 4px 0',
                  }}
                >
                  Agent 2 is reasoning…
                </p>

                <p
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '12px',
                    color: 'var(--lp-text-secondary)',
                    margin: '0 0 24px 0',
                  }}
                >
                  Traversing knowledge graph
                </p>

                {/* Step list */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}
                >
                  {AGENT2_STEPS.map((stepLabel, i) => {
                    const state =
                      i < activeStep
                        ? 'done'
                        : i === activeStep
                          ? 'active'
                          : 'pending';
                    return (
                      <div
                        key={stepLabel}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <StepDot state={state} />
                        <span
                          style={{
                            fontFamily: 'var(--font-inter), system-ui, sans-serif',
                            fontSize: '12px',
                            color:
                              state === 'pending'
                                ? 'var(--lp-text-hint)'
                                : state === 'active'
                                  ? 'var(--lp-text-primary)'
                                  : 'var(--lp-text-secondary)',
                          }}
                        >
                          {stepLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Architecture diagram — revealed after processing */}
          <AnimatePresence>
            {!processing && (
              <motion.div
                key="arch-diagram"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                }}
              >
                <ArchDiagram
                  nodes={convertForgeNodes(displayNodes, displayEdges)}
                  edges={convertForgeEdges(displayEdges)}
                  onNodeSelect={handleNodeClick}
                  selectedNodeId={selectedNodeId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Alternatives rejected panel ─────────────────────────────────────── */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              key="alternatives-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
              style={{
                marginTop: '28px',
                flexShrink: 0,
              }}
              aria-label="Alternatives considered"
            >
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--lp-text-hint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 10px 0',
                }}
              >
                Alternatives Considered
              </p>

              {ALTERNATIVES.map((alt, i) => (
                <div
                  key={alt.name}
                  style={{
                    display: 'inline-flex',
                    gap: '8px',
                    padding: '8px 0',
                    borderBottom:
                      i < ALTERNATIVES.length - 1
                        ? '0.5px solid var(--lp-border)'
                        : 'none',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '11px',
                      color: 'var(--lp-text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {alt.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '11px',
                      color: 'var(--lp-text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {alt.reason}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA: Continue to Build ──────────────────────────────────────────── */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              key="cta-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              style={{
                marginTop: 'auto',
                paddingTop: '20px',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <motion.button
                type="button"
                onClick={handleContinueToBuild}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  padding: '8px 20px',
                  background: 'var(--lp-accent-dim)',
                  border: '0.5px solid rgba(45,212,191,0.3)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--lp-accent)',
                  cursor: 'pointer',
                }}
                aria-label="Continue to Build stage"
              >
                Continue to Build →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Node inspector panel (collapsible right edge) ─────────────────────── */}
      <NodeInspector node={selectedNode} onClose={handleCloseInspector} />
    </div>
  );
}
