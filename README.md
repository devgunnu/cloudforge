# CloudForge

Visual AWS infrastructure builder. Drag services onto a canvas, connect them, hit deploy — CloudForge generates and provisions real Terraform instantly.

Built for a hackathon with Next.js 15 + Claude AI.

---

## What it does

1. **Draw** — Drag Lambda, S3, RDS, VPC and 6 other AWS services onto a React Flow canvas
2. **Connect** — Wire services together to express data flow and IAM relationships
3. **Deploy** — Claude generates production-grade HCL; AWS Cloud Control API provisions the real resources

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TypeScript |
| Canvas | `@xyflow/react` v12 |
| State | Zustand v5 |
| Animations | Framer Motion |
| Styling | Tailwind v4 |
| AI | Claude Sonnet (Terraform generation) |
| IaC | Terraform + AWS Cloud Control API |

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — landing page.
Open [http://localhost:3000/builder](http://localhost:3000/builder) — canvas builder.

---

## Project structure

```
cloudforge/
├── src/
│   ├── app/
│   │   ├── (landing)/          # Marketing site at /
│   │   └── (builder)/builder/  # Canvas builder at /builder
│   ├── components/
│   │   ├── canvas/             # React Flow canvas + node components
│   │   └── landing/            # Landing page sections
│   ├── store/                  # Zustand canvas store + deploy state machine
│   └── lib/                    # AWS service catalogue, topology export, mock deploy
└── packages/
    └── types/                  # Shared CloudForgeTopology schema
```

---

## Shared types

`packages/types` exports `CloudForgeTopology` — the contract between the frontend canvas and the Claude backend that generates Terraform. Both sides import from `@cloudforge/types`.

---

## Roadmap

- [ ] Real Claude API integration (Terraform generation)
- [ ] AWS Cloud Control API provisioning
- [ ] Cost estimation per topology
- [ ] Topology versioning + restore
- [ ] Multi-region support
