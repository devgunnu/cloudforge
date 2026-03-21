# Landing Page Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add social proof bar, static canvas mockup (video slot), and Terraform preview section to the main landing page; build a scroll-pinned interactive canvas demo at `/test`.

**Architecture:** Four new/modified components on the main landing page + one new self-contained page at `/test`. All new components follow the existing Direction C design system (`--lp-*` CSS tokens, `.lp-card` hover, Framer Motion `whileInView`). No new dependencies needed — framer-motion, lucide-react, and @xyflow/react are already installed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Framer Motion, Tailwind v4, lucide-react

**Judges context:** Anthropic (Claude Code) + Amazon — Claude API story must be front-and-center; Terraform HCL must be syntactically correct real AWS provider code.

---

### Task 1: SocialProof component

**Files:**
- Create: `src/components/landing/SocialProof.tsx`
- Modify: `src/app/(landing)/page.tsx`

**Step 1: Create `src/components/landing/SocialProof.tsx`**

```tsx
'use client';

import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

const PILLS = [
  { label: 'Built at Anthropic Hackathon', accent: true },
  { label: 'Claude Sonnet 3.5', accent: false },
  { label: 'AWS Cloud Control API', accent: false },
  { label: '10 AWS services', accent: false },
] as const;

export default function SocialProof() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: EASE }}
      style={{
        borderTop: '1px solid var(--lp-border)',
        borderBottom: '1px solid var(--lp-border)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {PILLS.map((pill) => (
        <div
          key={pill.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: pill.accent ? 'var(--lp-accent-dim)' : 'var(--lp-surface)',
            border: `0.5px solid ${pill.accent ? 'rgba(110,171,133,0.25)' : 'var(--lp-border-hover)'}`,
            borderRadius: '100px',
          }}
        >
          {pill.accent && (
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--lp-accent)',
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '12px',
              color: pill.accent ? 'var(--lp-accent)' : 'var(--lp-text-secondary)',
              fontWeight: pill.accent ? 500 : 400,
              letterSpacing: '0.01em',
            }}
          >
            {pill.label}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
```

**Step 2: Add SocialProof to page.tsx between Hero and HowItWorks**

In `src/app/(landing)/page.tsx`, import and place after `<Hero />`:
```tsx
import SocialProof from '@/components/landing/SocialProof';
// ...
<Hero />
<SocialProof />
<HowItWorks />
```

**Step 3: Verify**

Run `npm run build` — expect 0 TypeScript errors. Visually check at `http://localhost:3000` — the pill strip should appear between hero and how-it-works sections.

**Step 4: Commit**

```bash
git add src/components/landing/SocialProof.tsx src/app/(landing)/page.tsx
git commit -m "feat(landing): add social proof bar with hackathon + AWS + Claude pills"
```

---

### Task 2: Static canvas mockup (video slot) in Hero

**Files:**
- Create: `src/components/landing/CanvasMockup.tsx`
- Modify: `src/components/landing/Hero.tsx`

**Step 1: Create `src/components/landing/CanvasMockup.tsx`**

Mimics the real AWSNode card style (dark surface, cf-style border, category dot, icon, label) using plain divs — no @xyflow/react dependency. Three nodes: Lambda → API Gateway → RDS, connected by SVG edges.

```tsx
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

// Edge: from right-center of source node to left-center of target node
// Node card is 180px wide, ~58px tall
const NODE_W = 180;
const NODE_H = 58;

function MockEdge({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke="rgba(0,212,255,0.35)"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
  );
}

export default function CanvasMockup() {
  // Canvas bounding box: 420 x 200
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
          <MockEdge
            x1={NODES[0].x + NODE_W}
            y1={NODES[0].y + NODE_H / 2}
            x2={NODES[1].x}
            y2={NODES[1].y + NODE_H / 2}
          />
          {/* Lambda (right edge) → RDS (left edge) */}
          <MockEdge
            x1={NODES[0].x + NODE_W}
            y1={NODES[0].y + NODE_H / 2}
            x2={NODES[2].x}
            y2={NODES[2].y + NODE_H / 2}
          />
        </svg>

        {/* Nodes */}
        {NODES.map((node) => {
          const Icon = node.Icon;
          return (
            <div
              key={node.id}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Add CanvasMockup to Hero.tsx**

In `src/components/landing/Hero.tsx`, import `CanvasMockup` and add it below the `<TerminalAnimation />` motion.div. Wrap both in a column stack:

```tsx
import CanvasMockup from './CanvasMockup';

// Replace the terminal motion.div block with:
<motion.div
  initial={{ opacity: 0, y: 40 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.9, ease: EASE, delay: 0.32 }}
  style={{
    width: '100%',
    maxWidth: '620px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }}
>
  {/* Glow behind visuals */}
  <div
    style={{
      position: 'absolute',
      bottom: '-60px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80%',
      height: '100px',
      background: 'radial-gradient(ellipse at center, rgba(110,171,133,0.12) 0%, transparent 70%)',
      pointerEvents: 'none',
      filter: 'blur(20px)',
    }}
  />
  <TerminalAnimation />
  <CanvasMockup />
</motion.div>
```

**Step 3: Verify**

Build: `npm run build` — 0 errors. Visually: canvas mockup should appear below the terminal in the hero, showing 3 nodes with dashed cyan edges.

**Step 4: Commit**

```bash
git add src/components/landing/CanvasMockup.tsx src/components/landing/Hero.tsx
git commit -m "feat(landing): add static canvas mockup (video slot) to hero"
```

---

### Task 3: TerraformPreview section (replaces TechStack)

**Files:**
- Create: `src/components/landing/TerraformPreview.tsx`
- Modify: `src/app/(landing)/page.tsx`

**Step 1: Create `src/components/landing/TerraformPreview.tsx`**

```tsx
'use client';

import { motion } from 'framer-motion';
import { Zap, Globe, Database } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

const HCL = `provider "aws" {
  region = "us-east-1"
}

resource "aws_lambda_function" "api_handler" {
  function_name = "cloudforge-api-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_exec.arn
  filename      = "lambda.zip"

  environment {
    variables = {
      DB_HOST = aws_db_instance.postgres.endpoint
    }
  }
}

resource "aws_api_gateway_rest_api" "main" {
  name        = "cloudforge-api"
  description = "Generated by CloudForge"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api_handler.invoke_arn
}

resource "aws_db_instance" "postgres" {
  identifier        = "cloudforge-db"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  username          = "admin"
  password          = var.db_password
  skip_final_snapshot = true
}`;

// Minimal syntax highlighting: keywords, strings, resource types
function highlight(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /\b(provider|resource|variable|output|locals|module|data|terraform)\b/g,
      '<span style="color:#6EAB85;font-weight:500">$1</span>'
    )
    .replace(
      /"([^"]+)"/g,
      '<span style="color:#A3C9B4">"$1"</span>'
    )
    .replace(
      /\b(true|false|null)\b/g,
      '<span style="color:#9CA3AF">$1</span>'
    )
    .replace(
      /(#[^\n]*)/g,
      '<span style="color:#4B5563">$1</span>'
    );
}

const MINI_NODES = [
  { label: 'api-handler', subtitle: 'Lambda · nodejs20.x', dotColor: '#00ff87', iconColor: '#FF9900', Icon: Zap },
  { label: 'rest-api', subtitle: 'API Gateway · REST', dotColor: '#00d4ff', iconColor: '#FF4F8B', Icon: Globe },
  { label: 'postgres-db', subtitle: 'RDS · postgres 15', dotColor: '#00d4ff', iconColor: '#527FFF', Icon: Database },
];

export default function TerraformPreview() {
  return (
    <section
      style={{
        padding: '120px 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ marginBottom: '56px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ height: '1px', width: '32px', background: 'var(--lp-accent)', opacity: 0.6 }} />
          <span
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              color: 'var(--lp-text-hint)',
            }}
          >
            What CloudForge generates
          </span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: 'clamp(28px, 3.5vw, 42px)',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            maxWidth: '520px',
          }}
        >
          Draw a diagram.{' '}
          <span style={{ color: 'var(--lp-text-secondary)', fontWeight: 400 }}>
            Get production Terraform.
          </span>
        </h2>
      </motion.div>

      {/* Split layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '2px',
          background: 'var(--lp-border)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--lp-border)',
        }}
      >
        {/* Left: mini canvas */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{
            background: 'var(--lp-bg)',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '10px',
              color: 'var(--lp-text-hint)',
              marginBottom: '16px',
              letterSpacing: '0.05em',
            }}
          >
            // your diagram
          </div>
          {MINI_NODES.map((node, i) => {
            const Icon = node.Icon;
            return (
              <div
                key={node.label}
                style={{
                  background: '#12172b',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginLeft: i === 0 ? 0 : '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                  <div
                    style={{ width: '7px', height: '7px', borderRadius: '50%', background: node.dotColor, flexShrink: 0 }}
                  />
                  <Icon size={12} style={{ color: node.iconColor, flexShrink: 0 }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#cdd6f4',
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
              </div>
            );
          })}
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--lp-accent)' }} />
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '10px',
                color: 'var(--lp-accent)',
                letterSpacing: '0.02em',
              }}
            >
              claude generating terraform...
            </span>
          </div>
        </motion.div>

        {/* Right: HCL output */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          style={{
            background: '#0D0F13',
            padding: '0',
            overflow: 'hidden',
          }}
        >
          {/* File tab */}
          <div
            style={{
              padding: '10px 20px',
              borderBottom: '1px solid var(--lp-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(110,171,133,0.4)' }} />
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '11px',
                color: 'var(--lp-text-secondary)',
              }}
            >
              main.tf
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '10px',
                color: 'var(--lp-text-hint)',
              }}
            >
              generated by claude
            </span>
          </div>
          {/* Code */}
          <pre
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '11.5px',
              lineHeight: 1.75,
              color: 'var(--lp-text-secondary)',
              padding: '20px',
              margin: 0,
              overflowX: 'auto',
              maxHeight: '380px',
              overflowY: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: highlight(HCL) }}
          />
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Update page.tsx — swap TechStack for TerraformPreview**

```tsx
// Remove: import TechStack from '@/components/landing/TechStack';
// Add:
import TerraformPreview from '@/components/landing/TerraformPreview';

// In JSX, replace <TechStack /> with:
<TerraformPreview />
```

**Step 3: Verify**

`npm run build` — 0 errors. Visually: two-column split shows mini canvas nodes on the left, syntax-highlighted `main.tf` on the right, "claude generating terraform..." status line at the bottom of the left column.

**Step 4: Commit**

```bash
git add src/components/landing/TerraformPreview.tsx src/app/(landing)/page.tsx
git commit -m "feat(landing): add Terraform preview section — replaces TechStack"
```

---

### Task 4: Scroll-pinned canvas demo at `/test`

**Files:**
- Create: `src/app/test/page.tsx`

**Step 1: Create `src/app/test/page.tsx`**

```tsx
'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Zap, Globe, Database } from 'lucide-react';

// ─── design tokens (inline — page is self-contained) ────────────────────────
const C = {
  bg: '#0D0F13',
  surface: '#111318',
  elevated: '#12172b',
  border: 'rgba(255,255,255,0.06)',
  accent: '#6EAB85',
  accentDim: 'rgba(110,171,133,0.10)',
  textPrimary: '#E8E6E1',
  textSecondary: '#9CA3AF',
  textHint: '#4B5563',
  cyan: '#00d4ff',
  green: '#00ff87',
};

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── terraform lines streamed in final phase ─────────────────────────────────
const TF_LINES = [
  '+ aws_lambda_function.api_handler   created',
  '+ aws_api_gateway_rest_api.main     created',
  '+ aws_db_instance.postgres          created',
  '',
  'Apply complete! 3 added, 0 changed, 0 destroyed.',
];

// ─── node definitions ─────────────────────────────────────────────────────────
const NODES = [
  {
    id: 'lambda',
    label: 'api-handler',
    subtitle: 'nodejs20.x · 512mb',
    dotColor: C.green,
    iconColor: '#FF9900',
    Icon: Zap,
    // absolute position within 500x260 canvas area
    x: 20,
    y: 100,
  },
  {
    id: 'apigw',
    label: 'rest-api',
    subtitle: 'REST · edge',
    dotColor: C.cyan,
    iconColor: '#FF4F8B',
    Icon: Globe,
    x: 280,
    y: 20,
  },
  {
    id: 'rds',
    label: 'postgres-db',
    subtitle: 'postgres 15 · t3.micro',
    dotColor: C.cyan,
    iconColor: '#527FFF',
    Icon: Database,
    x: 280,
    y: 180,
  },
] as const;

const NODE_W = 180;
const NODE_H = 58;

// ─── scroll ranges for each animation phase ───────────────────────────────────
// Total scroll container height: 500vh → scroll progress 0–1
// Phase boundaries:
const P = {
  lambda:   [0.00, 0.18] as [number, number],
  apigw:    [0.18, 0.34] as [number, number],
  edge1:    [0.34, 0.50] as [number, number],
  rds:      [0.50, 0.64] as [number, number],
  edge2:    [0.64, 0.76] as [number, number],
  deploy:   [0.76, 0.88] as [number, number],
  terminal: [0.88, 1.00] as [number, number],
};

function useScrollRange(scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress'], [s, e]: [number, number]) {
  return useTransform(scrollYProgress, [s, e], [0, 1]);
}

// ─── Edge SVG path (cubic bezier) ─────────────────────────────────────────────
function Edge({
  x1, y1, x2, y2, progress,
}: {
  x1: number; y1: number; x2: number; y2: number;
  progress: ReturnType<typeof useTransform>;
}) {
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  // Approximate total path length
  const LENGTH = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 1.2;
  const dashoffset = useTransform(progress, (v) => LENGTH * (1 - v));

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={`rgba(0,212,255,0.5)`}
      strokeWidth="1.5"
      strokeDasharray={LENGTH}
      style={{ strokeDashoffset: dashoffset }}
    />
  );
}

// ─── Single mock node card ─────────────────────────────────────────────────────
function MockNode({
  node,
  opacity,
  y,
}: {
  node: (typeof NODES)[number];
  opacity: ReturnType<typeof useTransform>;
  y: ReturnType<typeof useTransform>;
}) {
  const Icon = node.Icon;
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_W,
        opacity,
        y,
        background: C.elevated,
        border: `0.5px solid ${C.border}`,
        borderRadius: '10px',
        padding: '10px 12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: node.dotColor, flexShrink: 0 }} />
        <Icon size={12} style={{ color: node.iconColor, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '12px', fontWeight: 500, color: '#cdd6f4' }}>
          {node.label}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '9px', color: '#6c7086', paddingLeft: '14px' }}>
        {node.subtitle}
      </div>
    </motion.div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ScrollDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });

  // Node opacity/y animations
  const lambdaOp = useTransform(scrollYProgress, P.lambda, [0, 1]);
  const lambdaY  = useTransform(scrollYProgress, P.lambda, [20, 0]);
  const apigwOp  = useTransform(scrollYProgress, P.apigw,  [0, 1]);
  const apigwY   = useTransform(scrollYProgress, P.apigw,  [-20, 0]);
  const rdsOp    = useTransform(scrollYProgress, P.rds,    [0, 1]);
  const rdsY     = useTransform(scrollYProgress, P.rds,    [20, 0]);

  // Edge draw progress
  const edge1Progress = useScrollRange(scrollYProgress, P.edge1);
  const edge2Progress = useScrollRange(scrollYProgress, P.edge2);

  // Deploy button pulse
  const deployOp   = useTransform(scrollYProgress, P.deploy, [0, 1]);
  const deployScale = useTransform(scrollYProgress, P.deploy, [0.9, 1]);
  const deployGlow = useTransform(scrollYProgress, P.deploy, [0, 1]);

  // Terminal lines
  const terminalOp = useTransform(scrollYProgress, P.terminal, [0, 1]);
  const line0Op = useTransform(scrollYProgress, [0.88, 0.91], [0, 1]);
  const line1Op = useTransform(scrollYProgress, [0.91, 0.94], [0, 1]);
  const line2Op = useTransform(scrollYProgress, [0.94, 0.96], [0, 1]);
  const line3Op = useTransform(scrollYProgress, [0.96, 0.98], [0, 1]);
  const line4Op = useTransform(scrollYProgress, [0.98, 1.00], [0, 1]);
  const lineOpacities = [line0Op, line1Op, line2Op, line3Op, line4Op];

  // Scroll hint
  const hintOp = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  // Canvas dimensions
  const CANVAS_W = 500;
  const CANVAS_H = 260;

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Tall scroll container */}
      <div ref={containerRef} style={{ height: '500vh', position: 'relative' }}>
        {/* Sticky viewport */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflow: 'hidden',
          }}
        >
          {/* Section label */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            style={{
              marginBottom: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ height: '1px', width: '32px', background: C.accent, opacity: 0.6 }} />
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textHint }}>
              See it build
            </span>
          </motion.div>

          {/* Canvas area */}
          <div
            style={{
              position: 'relative',
              width: CANVAS_W,
              height: CANVAS_H,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '16px',
              overflow: 'visible',
              marginBottom: '24px',
            }}
          >
            {/* SVG edges layer */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
              {/* Lambda right → API GW left */}
              <Edge
                x1={NODES[0].x + NODE_W}
                y1={NODES[0].y + NODE_H / 2}
                x2={NODES[1].x}
                y2={NODES[1].y + NODE_H / 2}
                progress={edge1Progress}
              />
              {/* Lambda right → RDS left */}
              <Edge
                x1={NODES[0].x + NODE_W}
                y1={NODES[0].y + NODE_H / 2}
                x2={NODES[2].x}
                y2={NODES[2].y + NODE_H / 2}
                progress={edge2Progress}
              />
            </svg>

            {/* Nodes */}
            <MockNode node={NODES[0]} opacity={lambdaOp} y={lambdaY} />
            <MockNode node={NODES[1]} opacity={apigwOp} y={apigwY} />
            <MockNode node={NODES[2]} opacity={rdsOp} y={rdsY} />
          </div>

          {/* Deploy button */}
          <motion.button
            style={{
              opacity: deployOp,
              scale: deployScale,
              background: C.accentDim,
              border: `0.5px solid rgba(110,171,133,0.3)`,
              borderRadius: '10px',
              padding: '12px 32px',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              color: C.accent,
              cursor: 'default',
              marginBottom: '24px',
              boxShadow: useTransform(deployGlow, (v) => `0 0 ${v * 24}px rgba(110,171,133,${v * 0.2})`),
            }}
          >
            Deploy infrastructure →
          </motion.button>

          {/* Terminal output */}
          <motion.div
            style={{
              opacity: terminalOp,
              width: '100%',
              maxWidth: '500px',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              padding: '16px 20px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '12px',
              lineHeight: 1.8,
            }}
          >
            {TF_LINES.map((line, i) => (
              <motion.div
                key={i}
                style={{
                  opacity: lineOpacities[i],
                  color: line.startsWith('+')
                    ? C.accent
                    : line.startsWith('Apply')
                    ? C.textPrimary
                    : C.textSecondary,
                }}
              >
                {line || '\u00A0'}
              </motion.div>
            ))}
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            style={{
              opacity: hintOp,
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '12px', color: C.textHint }}>
              Scroll to build your infrastructure
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ color: C.textHint, fontSize: '16px' }}
            >
              ↓
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

`npm run build` — 0 errors. Visit `http://localhost:3000/test` and scroll slowly — Lambda node should fade in first, then API GW, then edges draw, then RDS, then deploy button pulses, then terminal streams lines.

**Step 3: Commit**

```bash
git add src/app/test/page.tsx
git commit -m "feat(test): scroll-pinned canvas build demo (Approach C)"
```

---

### Task 5: Push and verify build

**Step 1: Final build check**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with 0 errors, 0 warnings.

**Step 2: Push**

```bash
git push
```
