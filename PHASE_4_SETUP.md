# Phase 4 — Real AI Backend Setup

The Gaffer now has a real Python/FastAPI backend powered by Claude API. This guide walks you through setup and verification.

## Prerequisites

- Python 3.11+ (check: `python --version`)
- Anthropic API key (get one at https://console.anthropic.com/)
- Node.js 18+ for the frontend (already installed)

## Backend Setup

### 1. Install Server Dependencies

From the repo root:

```bash
cd server
pip install -e '.[dev]'
```

This installs FastAPI, Uvicorn, Claude SDK, and dev tools (ruff, mypy, pytest).

### 2. Configure the Backend

Copy the example `.env` template and add your API key:

```bash
cd server
# Edit .env and replace sk-ant- with your actual API key
nano .env  # or use your editor
```

The `.env` file is already created with:
- `ENVIRONMENT=local`
- `LOG_LEVEL=DEBUG`
- `SECRET_KEY=...` (dev-only, safe to leave)
- `CORS_ORIGINS=["http://localhost:5173"]` (allows Vite frontend)
- `ANTHROPIC_API_KEY=sk-ant-YOUR_API_KEY_HERE` ← **Replace this**

**⚠️ IMPORTANT:**
- Never commit `.env` with a real API key
- `.env` is already in `.gitignore`
- `.env.example` shows which variables are needed (no secrets)

### 3. Start the Backend

From the `server/` directory:

```bash
uvicorn app.main:app --reload --port 8000
```

You should see:

```
INFO:     Application startup complete
Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

API docs available at: http://localhost:8000/docs

### 4. Start the Frontend

In a new terminal, from the repo root:

```bash
npm run dev
```

The frontend proxies `/api` requests to `http://localhost:8000` via Vite's dev proxy.

## Testing

### Test via the UI

1. Open http://localhost:5173 in a browser
2. Click the avatar button (bottom-right) to open The Gaffer
3. Ask one of the suggested questions:
   - "Who is Jabez?"
   - "Show me his blockchain projects."
   - "What technologies does he know?"
   - "Why should I hire him?"
   - "Take me to his projects."
   - "I want to contact him."

Watch the avatar state flow: `idle` → `listening` → `thinking` → `speaking` → `complete` → `idle`

Text should stream incrementally, grounded in Jabez's portfolio knowledge (never invented).

### Test the Backend Directly

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"Who is Jabez?"}'
```

You should receive NDJSON (newline-delimited JSON):

```json
{"type":"chunk","delta":"Jabez "}
{"type":"chunk","delta":"Ananias "}
...
{"type":"done","message_id":"..."}
```

### Verify No API Key Exposure

1. Open browser DevTools (F12)
2. Go to Network tab
3. Ask a question in The Gaffer
4. Click on the `/api/v1/chat` POST request
5. Inspect the request/response headers and body
6. **Verify:** No `ANTHROPIC_API_KEY` appears anywhere in the request
   - The key stays on the backend only

## Switching Between Mock and Real Transport

### Use Real Backend (default)

```bash
# Default — uses realChatTransport calling /api/v1/chat
npm run dev
```

### Use Mock Transport (for testing without backend)

```bash
# Stop the backend server first, then:
VITE_USE_MOCK_TRANSPORT=true npm run dev
```

This uses the mock knowledge layer from Phase 3, streaming synthetic responses.

## Architecture Overview

```
Browser (Vite on :5173)
    ↓ [fetch /api/v1/chat]
Vite Dev Proxy (:5173)
    ↓ [forwards to]
FastAPI Backend (:8000)
    ↓ [sends]
Claude API
    ↓ [streams response with knowledge grounding]
Backend (/api/v1/chat)
    ↓ [yields NDJSON ChatStreamEvent]
Browser
    ↓ [parses discriminated union]
Frontend UI
```

### Key Components

**Backend:**
- `app/services/llm_service.py` — LLMProvider abstraction; currently ClaudeProvider
- `app/services/knowledge_service.py` — Portfolio knowledge grounding; system prompt
- `app/api/v1/routes/chat.py` — Streaming /api/v1/chat endpoint
- `app/schemas/chat.py` — Request/response types matching frontend contract

**Frontend:**
- `lib/chat/realChatTransport.ts` — Fetches /api/v1/chat, parses NDJSON
- `lib/chat/transportFactory.ts` — Chooses real vs. mock based on env flag
- `config/env.ts` — Environment configuration (API base URL, mock flag)

## Error Scenarios

### Backend Unavailable

If the backend is down, `realChatTransport` emits:

```json
{"type":"error","error":{"code":"network_error","message":"Failed to reach the backend: ..."}}
```

The UI shows the error state. Restart the backend and retry.

### Invalid API Key

```
httpx.auth.InvalidBearerToken
```

Or:

```json
{"type":"error","error":{"code":"llm_error","message":"The Gaffer encountered an error..."}}
```

Check your `ANTHROPIC_API_KEY` in `server/.env`.

### Timeout

If Claude takes too long (>60s typically), the request times out. The frontend receives an error event. Retry the question.

## Type Safety

Both backend and frontend are type-checked:

```bash
# Frontend
npm run typecheck

# Backend
cd server
mypy app
```

The discriminated union `ChatStreamEvent` ensures exhaustive handling on both sides.

## Security Notes

✅ **API key never reaches the browser**
- Only stored in server-side `.env`
- CORS allows frontend origin only
- Request-ID middleware for tracing

✅ **User input is untrusted**
- Frontend validates message length (max 2000 chars)
- Backend validates again; FastAPI Pydantic enforces types
- Claude prompt injection risk is mitigated by grounding in portfolio knowledge

✅ **.env files are ignored**
- `.env` (real secrets) in `.gitignore`
- `.env.example` (template) is committed for reference

⚠️ **Prompt injection is possible but mitigated**
- Claude could theoretically be tricked to ignore instructions
- The system prompt emphasizes grounding in documented portfolio facts
- If critical, consider a retrieval-augmented generation (RAG) approach with vector search to enforce knowledge boundaries more strictly

## Production Considerations

This Phase 4 setup is **development-only**. For production:

1. **Secret Management:** Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) — not `.env` files
2. **Knowledge Source:** Move portfolio knowledge to a database or shared API — not duplicated in Python/TypeScript
3. **Rate Limiting:** Add per-IP rate limits to `/api/v1/chat` to prevent abuse
4. **Monitoring:** Log all requests and Claude API usage for cost tracking and debugging
5. **Caching:** Cache frequently asked questions to reduce API costs
6. **Authentication:** If this becomes a shared assistant, add user auth to the backend
7. **HTTPS:** Use HTTPS in production; set secure CORS origins
8. **Database:** Store conversation history if needed; currently all requests are stateless

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'anthropic'` | Run `pip install -e '.[dev]'` in `server/` |
| `400 Bad Request` from backend | Check `ANTHROPIC_API_KEY` is set and valid |
| Frontend shows "network error" | Ensure backend is running on `:8000`; check CORS settings |
| CORS error in browser | Verify `CORS_ORIGINS` in `server/.env` includes `http://localhost:5173` |
| Typecheck fails | Run `mypy app` and `npm run typecheck` to see specific errors |
| `DOMException: AbortError` | User cancelled the request — this is normal, not an error |

## Next Steps (Phase 5+)

- Real 3D avatar (Blender/GLB + React Three Fiber)
- Conversation history persistence
- User authentication
- Production deployment (Docker, cloud platform)
- Advanced RAG for dynamic knowledge retrieval
- Multi-modal input (voice, images)
