# Frontend — Startup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | bundled with Node |

---

## 1. Install dependencies

```bash
cd frontend
npm install
```

---

## 2. Configure environment

Create `frontend/.env.local` (already gitignored):

```bash
cp .env.local.sample .env.local   # if sample exists
# or create manually:
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI backend URL |

---

## 3. Start the dev server

Make sure the backend is running first (see `backend/STARTUP.md`), then:

```bash
cd frontend
npm run dev
```

App runs at `http://localhost:3000`.

---

## 4. Verify

Open `http://localhost:3000` — you should see the CloudForge landing page.

Navigate to `/signup` to create an account. The form POSTs to the backend; on success you are redirected to `/dashboard`.

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

---

## Project structure

```
src/
  app/              # Next.js App Router pages
    (auth)/         # login, signup
    dashboard/      # project list
    app/            # forge screens (requirements → architecture → build → deploy)
  lib/
    forge-agents.ts # SSE client for all 4 agents — pass projectId for real calls
  store/
    authStore.ts    # JWT tokens + user (persisted to localStorage)
    forgeStore.ts   # active forge session state
    projectStore.ts # project list + API actions
```

---

## Auth flow

1. Register or log in → tokens saved to `localStorage` via `authStore`
2. All API calls in `forge-agents.ts` read the token from `authStore.getAccessToken()`
3. To use real backend endpoints, pass `projectId` to each agent function:
   ```ts
   await runAgent1(prdText, onChip, project.id)
   await runAgent2(chips, onStep, project.id)
   await runAgent3(archData, callbacks, project.id)
   await runDeploy(files, archData, callbacks, project.id)
   ```
4. Omit `projectId` to fall back to mock data (useful when backend is unavailable)

---

## Troubleshooting

**`fetch` fails with CORS error**
→ Ensure `FRONTEND_URL=http://localhost:3000` is set in the backend `.env` and the backend is running.

**`401 Unauthorized` on all requests**
→ Token expired or missing. Log out and log back in. Check `localStorage` key `cloudforge-auth`.

**SSE stream hangs or never completes**
→ The backend agent is still running. Open `http://localhost:8000/docs` to check endpoint health. For Agent 2/3 with Ollama, first inference can take 30–60 s on first model load.

**`NEXT_PUBLIC_API_URL` is undefined**
→ `.env.local` is missing or was created after `npm run dev` was started. Restart the dev server after creating the file.
