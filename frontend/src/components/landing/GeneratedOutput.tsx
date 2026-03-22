'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

type Tab = 'terraform' | 'scaffold' | 'deploy';

const TERRAFORM_LINES = [
  { text: 'provider "aws" {', type: 'keyword' },
  { text: '  region = "us-east-1"', type: 'string' },
  { text: '}', type: 'plain' },
  { text: '', type: 'plain' },
  { text: 'resource "aws_iam_role" "lambda_exec" {', type: 'keyword' },
  { text: '  name = "cloudforge-lambda-exec"', type: 'string' },
  { text: '  assume_role_policy = jsonencode({', type: 'plain' },
  { text: '    Version = "2012-10-17"', type: 'string' },
  { text: '    Statement = [{', type: 'plain' },
  { text: '      Action    = "sts:AssumeRole"', type: 'string' },
  { text: '      Effect    = "Allow"', type: 'string' },
  { text: '      Principal = { Service = "lambda.amazonaws.com" }', type: 'string' },
  { text: '    }]', type: 'plain' },
  { text: '  })', type: 'plain' },
  { text: '}', type: 'plain' },
  { text: '', type: 'plain' },
  { text: 'resource "aws_lambda_function" "api_handler" {', type: 'keyword' },
  { text: '  function_name = "api-handler"', type: 'string' },
  { text: '  runtime       = "nodejs20.x"', type: 'string' },
  { text: '  handler       = "index.handler"', type: 'string' },
  { text: '  role          = aws_iam_role.lambda_exec.arn', type: 'plain' },
  { text: '  memory_size   = 512', type: 'plain' },
  { text: '}', type: 'plain' },
  { text: '', type: 'plain' },
  { text: 'resource "aws_db_instance" "postgres_db" {', type: 'keyword' },
  { text: '  identifier     = "cloudforge-db"', type: 'string' },
  { text: '  engine         = "postgres"', type: 'string' },
  { text: '  engine_version = "15"', type: 'string' },
  { text: '  instance_class = "db.t3.micro"', type: 'string' },
  { text: '}', type: 'plain' },
];

const DEPLOY_LINES = [
  { text: '$ cloudforge deploy --project my-app --env prod', final: false },
  { text: '  ↳ Assuming role arn:aws:iam::123456789:role/cloudforge-access', final: false },
  { text: '  ↳ Initializing Terraform...', final: false },
  { text: '  ↳ Planning: 4 resources to create', final: false },
  { text: '  ↳ aws_iam_role.lambda_exec ... created', final: false },
  { text: '  ↳ aws_lambda_function.api_handler ... created', final: false },
  { text: '  ↳ aws_db_instance.postgres_db ... created (42s)', final: false },
  { text: '  ↳ aws_api_gateway_rest_api.rest_api ... created', final: false },
  { text: '', final: false },
  { text: '  ✓ 4 resources live · us-east-1 · 4.2s', final: true },
];

const FILE_TREE = `my-app/
├── src/
│   ├── handlers/
│   │   └── api.ts
│   ├── db/
│   │   └── client.ts
│   └── index.ts
├── infra/
│   └── main.tf
├── package.json
└── README.md`;

function getLineColor(type: string): string {
  if (type === 'keyword') return 'var(--lp-accent)';
  if (type === 'string') return '#a5f3fc';
  return '#9CA3AF';
}

function TerraformTab() {
  return (
    <div style={{ background: '#0a0d0b', border: '1px solid #1e2620', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1e2620', background: '#111614' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c840' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px', color: '#9CA3AF' }}>main.tf</span>
        <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', color: '#4B5563' }}>Written by CloudForge · Claude Sonnet · 2.3s</span>
      </div>
      {/* Code */}
      <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
        <style>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
        {TERRAFORM_LINES.map((line, i) => (
          <div key={i} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '13px', lineHeight: '1.6', color: getLineColor(line.type), whiteSpace: 'pre' }}>
            {line.text || '\u00a0'}
            {i === TERRAFORM_LINES.length - 1 && (
              <span style={{ borderRight: '2px solid var(--lp-accent)', marginLeft: '1px', animation: 'blink 1s step-end infinite' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScaffoldTab() {
  return (
    <div>
      <div style={{ background: '#0a0d0b', border: '1px solid #1e2620', borderRadius: '8px', padding: '20px', marginBottom: '12px' }}>
        <pre style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '13px', color: '#9CA3AF', margin: 0, lineHeight: 1.7, overflow: 'auto' }}>
          {FILE_TREE}
        </pre>
      </div>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        background: 'rgba(45,212,191,0.08)',
        border: '1px solid rgba(45,212,191,0.2)',
        borderRadius: '100px',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: '12px',
        color: 'var(--lp-accent)',
      }}>
        Full codebase written by CloudForge · pushed to github.com/user/my-app
      </div>
    </div>
  );
}

function DeployTab() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setVisibleLines(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    DEPLOY_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), i * 150));
    });
    return () => timers.forEach(clearTimeout);
  }, [key]);

  return (
    <div>
      <div style={{ background: '#0a0d0b', border: '1px solid #1e2620', borderRadius: '8px', padding: '20px', marginBottom: '12px' }}>
        {DEPLOY_LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '13px',
              lineHeight: '1.7',
              color: line.final ? 'var(--lp-accent)' : '#9CA3AF',
              whiteSpace: 'pre',
            }}
          >
            {line.text || '\u00a0'}
          </div>
        ))}
      </div>
      <button
        onClick={() => setKey((k) => k + 1)}
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '11px',
          color: 'var(--lp-text-hint)',
          background: 'transparent',
          border: '1px solid var(--lp-border)',
          borderRadius: '6px',
          padding: '4px 12px',
          cursor: 'pointer',
        }}
      >
        ↺ replay
      </button>
    </div>
  );
}

export default function GeneratedOutput() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [activeTab, setActiveTab] = useState<Tab>('terraform');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'terraform', label: 'Infrastructure' },
    { id: 'scaffold', label: 'App Codebase' },
    { id: 'deploy', label: 'Deploy Log' },
  ];

  return (
    <section ref={ref} style={{ background: 'var(--lp-bg)', padding: '100px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '11px', fontWeight: 600, color: 'var(--lp-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}
        >
          WHAT CLOUDFORGE GENERATES
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, color: 'var(--lp-text-primary)', textAlign: 'center', letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: 1.1 }}
        >
          Tell us what to build. We build it.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '16px',
            color: 'var(--lp-text-secondary)',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto 48px',
            lineHeight: 1.65,
          }}
        >
          Describe what you&apos;re building. Iterate with the agent until it&apos;s right.{' '}
          CloudForge writes your application code and AWS infrastructure —{' '}
          then deploys it to your own AWS account.
        </motion.p>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '1px solid var(--lp-border)' }}
        >
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: activeTab === id ? 500 : 400,
                color: activeTab === id ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === id ? '2px solid var(--lp-accent)' : '2px solid transparent',
                padding: '8px 20px',
                cursor: 'pointer',
                marginBottom: '-1px',
                transition: 'color 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
        >
          {activeTab === 'terraform' && <TerraformTab />}
          {activeTab === 'scaffold' && <ScaffoldTab />}
          {activeTab === 'deploy' && <DeployTab />}
        </motion.div>
      </div>
    </section>
  );
}
