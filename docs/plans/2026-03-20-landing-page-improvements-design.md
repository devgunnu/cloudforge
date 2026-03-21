# Landing Page Improvements — Design Doc
**Date:** 2026-03-20
**Approach:** B (Hero + Social Proof + Terraform Preview) + C scroll demo at `/test`

## Context

Judges are Anthropic (Claude Code) + Amazon. This shapes every priority:
- Anthropic judges want to see Claude API as the core story, not a gimmick
- Amazon judge will scrutinize Terraform output and AWS service depth — needs real HCL syntax

## Changes to Main Landing (`/`)

### 1. Social Proof Bar (new component: `SocialProof.tsx`)
- Placed between Hero and HowItWorks
- Thin strip, 1px border top/bottom, full-width
- 4 pills in a centered row:
  - `✦ Built at [Hackathon]`
  - `Claude Sonnet` (Anthropic signal)
  - `AWS Cloud Control API` (Amazon signal)
  - `10 AWS services`
- Scroll reveal: fade in, `whileInView`, `once: true`

### 2. Hero — Static Canvas Mockup
- Below the TerminalAnimation, add a `CanvasMockup` component
- Renders 3 styled nodes (Lambda → API Gateway → RDS) as divs matching the real builder's node style
- SVG edges connecting them
- Label: "// video demo coming soon" as a tiny caption
- `maxWidth: 760px`, centered, sage glow underneath
- **Note:** User will replace with a video embed later — keep it as a swappable slot

### 3. Terraform Preview Section (new component: `TerraformPreview.tsx`)
Replaces the TechStack section entirely.

**Layout:** Two-column split at `1100px` max-width
- **Left (40%):** Mini canvas diagram — same 3-node mockup (Lambda → API GW → RDS), slightly smaller, with a faint border and surface background
- **Right (60%):** Syntax-highlighted Terraform HCL block

**HCL content must use real AWS provider syntax:**
```hcl
resource "aws_lambda_function" "api_handler" {
  function_name = "cloudforge-api-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_exec.arn
  filename      = "lambda.zip"
}

resource "aws_api_gateway_rest_api" "main" {
  name = "cloudforge-api"
}

resource "aws_db_instance" "postgres" {
  identifier     = "cloudforge-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  username       = "admin"
  password       = var.db_password
}
```

**Section label:** "What CloudForge generates" with the usual eyebrow pattern
**Scroll reveal:** staggered — left panel then right panel

### 4. Page Structure (updated)
```
LandingNav
Hero (with static CanvasMockup below terminal)
SocialProof          ← new
HowItWorks
Features
TerraformPreview     ← new, replaces TechStack
CTA
```

## Changes to `/test`

### Scroll-Pinned Canvas Demo (new file: `src/app/test/page.tsx`)
A single-page scroll-driven animation sequence using Framer Motion `useScroll` + `useTransform`:

**Sequence (triggered by scroll progress 0→1):**
1. `0.0–0.15` — Lambda node fades + slides in from left
2. `0.15–0.30` — API Gateway node fades + slides in from top
3. `0.30–0.45` — SVG edge draws between Lambda → API GW (stroke-dashoffset animation)
4. `0.45–0.60` — RDS node fades + slides in from right
5. `0.60–0.70` — Edge draws API GW → RDS
6. `0.70–0.85` — "Deploy" button pulses with sage glow
7. `0.85–1.00` — Terminal streams 4 lines of Terraform output, one per scroll increment

**Sticky container:** `position: sticky, top: 0, height: 100vh` inside a tall scroll container (`height: 400vh`)
**Scroll hint:** "Scroll to build your infrastructure" label that fades out after step 1

## Constraints
- All new components follow Direction C design system (`--lp-*` tokens, CSS-only hover via `.lp-card`)
- No inline JS hover handlers
- `'use client'` only where Framer Motion or state is used
- Terraform HCL must be syntactically correct (Amazon judge will notice)
- Static canvas mockup must use the exact same visual style as `AWSNode.tsx`
- Video slot in Hero must be clearly marked with a `/* VIDEO_SLOT */` comment for easy swap
