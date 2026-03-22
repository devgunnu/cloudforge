# Backend — Startup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12+ | [python.org](https://python.org) |
| uv | latest | `pip install uv` |
| MongoDB | 7.0+ | [mongodb.com](https://www.mongodb.com/try/download/community) |
| Ollama | latest | [ollama.com](https://ollama.com) — only if using local LLMs |

---

## 1. Install dependencies

```bash
cd backend
uv sync
```

---

## 2. Configure environment

```bash
cp .env.sample .env
```

Open `.env` and fill in the required values:

**Required (server will not start without these):**

```bash
# Generate JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
# → paste as JWT_SECRET_KEY

# Generate Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# → paste as FERNET_KEY
```

**Optional but recommended:**

- `ANTHROPIC_API_KEY` — set `ARCH_MODEL_TYPE=anthropic` to use Claude for Agent 2 instead of Ollama
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — required for GitHub OAuth (connect repos, commit scaffold)

**GitHub OAuth setup:**
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
2. Homepage URL: `http://localhost:3000`
3. Callback URL: `http://localhost:8000/auth/github/callback`
4. Copy Client ID and Client Secret into `.env`

---

## 3. Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
net start MongoDB

# Or run directly
mongod --dbpath ./data/db
```

---

## 4. Pull Ollama models (if using local LLMs)

```bash
ollama pull qwen3.5        # Agent 1 and Agent 3
ollama pull llama3.1:8b    # Agent 2 (or set ARCH_MODEL_TYPE=anthropic)
```

---

## 5. Start the server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On startup you should see:
```
INFO     MongoDB connected
INFO     Kuzu loaded
INFO     Uvicorn running on http://0.0.0.0:8000
```

---

## 6. Verify

```bash
curl http://localhost:8000/health
# → {"status": "ok"}

curl http://localhost:8000/docs
# → Open in browser for interactive API docs (Swagger UI)
```

---

## API Overview

| Prefix | Description |
|--------|-------------|
| `POST /auth/register` | Create account |
| `POST /auth/login` | Get JWT tokens |
| `GET  /auth/github` | Start GitHub OAuth |
| `GET  /auth/github/callback` | GitHub OAuth callback |
| `GET  /auth/me` | Current user |
| `POST /projects` | Create project |
| `GET  /projects` | List projects |
| `POST /workflows/prd/v2/start/{id}` | Run Agent 1 (SSE) |
| `POST /workflows/prd/v2/accept/{id}` | Accept PRD |
| `POST /workflows/architecture/v2/start/{id}` | Run Agent 2 (SSE) |
| `POST /workflows/architecture/v2/accept/{id}` | Accept architecture |
| `POST /workflows/build/start/{id}` | Run Agent 3 (SSE) |
| `POST /workflows/build/{id}/commit` | Commit to GitHub |
| `POST /workflows/deploy/start/{id}` | Deploy to cloud (SSE) |

Full docs at `http://localhost:8000/docs` when running.

---

## Troubleshooting

**`RuntimeError: MongoDB client is not initialized`**
→ MongoDB is not running. Start `mongod` first.

**`Kuzu init failed`**
→ `graph.json` is missing at `GRAPH_JSON_PATH`. Agent 2 will still work but without knowledge graph enrichment.

**`FERNET_KEY` is empty**
→ Encryption will fail on credential storage. Generate and set the key (see step 2).

**Agent 2 timeout / slow**
→ Switch to Claude: set `ARCH_MODEL_TYPE=anthropic` and add `ANTHROPIC_API_KEY`.

**GitHub commit fails with 401**
→ User has not connected GitHub. Hit `GET /auth/github` to get the OAuth URL, complete the flow.
