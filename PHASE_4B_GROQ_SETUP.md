# Phase 4B — Groq API Setup

**Changed from:** Google Gemini API  
**Changed to:** Groq API (free tier)  

This is a **drop-in replacement** — all frontend code, knowledge grounding, and ChatTransport contracts remain unchanged.

## Quick Start

### 1. Get a Free Groq API Key

Go to: https://console.groq.com/

Sign up or log in → Get API key (instant)

(No credit card required for free tier)

### 2. Install Updated Dependencies

From the `server/` directory:

```bash
pip install -e '.[dev]'
```

This installs `groq>=0.9.0` (replaces `google-generativeai`).

### 3. Configure the Backend

Edit `server/.env`:

```bash
GROQ_API_KEY=gsk_YOUR_KEY_HERE...
GROQ_MODEL=openai/gpt-oss-120b
```

### 4. Run the Backend

```bash
cd server
uvicorn app.main:app --reload --port 8000
```

### 5. Run the Frontend

In a new terminal from repo root:

```bash
npm run dev
```

Open http://localhost:5173 and test The Gaffer.

## What Changed

| Component | Before | After | Notes |
|-----------|--------|-------|-------|
| API Provider | Google Gemini | Groq | Free tier, fast inference |
| SDK | `google-generativeai>=0.8.0` | `groq>=0.9.0` | Official Groq SDK |
| Config Keys | `GEMINI_API_KEY`, `GEMINI_MODEL` | `GROQ_API_KEY`, `GROQ_MODEL` | Model configurable |
| LLMProvider | `GeminiProvider` | `GroqProvider` | Abstraction preserved |
| Streaming | Word-by-word (simulated) | Real token streaming | Actual Groq streaming |
| Frontend | N/A | **No changes** | Same ChatStreamEvent contract |
| Knowledge | N/A | **No changes** | System prompt, portfolio facts identical |

## Architecture

```
Browser
    ↓ (fetch /api/v1/chat)
FastAPI (:8000)
    ↓ (LLMProvider abstraction)
GroqProvider
    ↓ (groq SDK with streaming)
Groq API
    ↓ (real token streaming)
Backend
    ↓ (yields ChatStreamEvent NDJSON)
Frontend realChatTransport
    ↓ (parses discriminated union)
Avatar + Chat UI
```

**Key point:** The frontend doesn't know Groq replaced Gemini. All contracts are preserved.

## Groq Free Tier Limits

- **30 requests per minute** (standard free tier)
- **14,000 tokens per minute** (varies by model)
- **`openai/gpt-oss-120b`** model available on free tier
- Requests are rate-limited, not blocked — when hit, user sees: `"I'm temporarily unavailable. Please try again in a little while."`

For a portfolio chatbot, this is sufficient. Production deployments can upgrade.

## Model: `openai/gpt-oss-120b`

- Large open-source model optimized for latency
- Supports reasoning via `reasoning_effort=medium` parameter
- Good for portfolio Q&A, grounding, knowledge tasks
- Real token streaming (unlike Gemini)
- Faster inference than most alternatives

Configuration:
- `temperature=1` (deterministic, appropriate for facts)
- `max_completion_tokens=2048` (enough for portfolio discussions)
- `top_p=1` (no sampling restrictions)
- `reasoning_effort=medium` (balanced compute)
- `stream=True` (real streaming)

## Error Handling

### Invalid API Key

```
AuthenticationError: Invalid API Key provided
```

→ Check `GROQ_API_KEY` in `server/.env`

### Rate Limited

```json
{"type":"error","error":{"code":"rate_limit","message":"I'm temporarily unavailable. Please try again in a little while."}}
```

→ Wait a minute and retry (free tier: 30 req/min)

### Network Error

```json
{"type":"error","error":{"code":"llm_error","message":"The Gaffer encountered an error while thinking. Please try again."}}
```

→ Check internet; verify API key validity

## Verification

1. Open http://localhost:5173
2. Click avatar → ask "Who is Jabez?"
3. Check **DevTools Network tab** → `POST /api/v1/chat`
   - Request body: `{"content":"Who is Jabez?"}`
   - **Verify:** No `GROQ_API_KEY` in request (stays on backend only)
4. Watch avatar state: `idle` → `listening` → `thinking` → `speaking` → `complete` → `idle`
5. Verify text streams in real-time (true streaming, not word-by-word simulation)

## Real Streaming (vs. Gemini)

**Gemini (Phase 4A):** Full response generated server-side, then yielded word-by-word  
**Groq (Phase 4B):** Real token streaming from Groq API, chunks arrive incrementally

This makes the chat feel more responsive — text appears live as the model generates it.

## Switching to Mock Transport (for testing without backend)

```bash
VITE_USE_MOCK_TRANSPORT=true npm run dev
```

This uses Phase 3's mock knowledge layer. Useful for:
- Testing frontend without backend
- Debugging without burning API quota
- Ensuring UI works offline

## Why Groq (over Gemini)?

✅ **Real streaming** — tokens arrive incrementally, not full response at once  
✅ **Faster** — Groq's inference is optimized for latency  
✅ **Free tier** — No credit card, instant API key  
✅ **Open model** — `openai/gpt-oss-120b` is transparent about architecture  
✅ **Better for chat** — Streaming makes chat feel more interactive  

## Production Notes

For production deployments:

1. Move `GROQ_API_KEY` to a secrets manager (AWS Secrets Manager, Vault, etc.)
2. Use a reverse proxy (nginx, Cloudflare) to enforce rate limits
3. Cache frequently asked questions to reduce API usage
4. Monitor Groq API costs: free tier is 30 req/min
5. Consider upgrading to a paid tier if usage exceeds free limits

## Reverting to Gemini (if needed)

If you want to switch back to Gemini:

1. `pip install google-generativeai>=0.8.0`
2. Update `server/app/core/config.py` — change `groq_api_key` back to `gemini_api_key`
3. Create `GeminiProvider` class in `server/app/services/llm_service.py` (see git history or PHASE_4A_GEMINI_SETUP.md)
4. Update `get_llm_provider()` factory
5. Update `server/.env`
6. Update error handling in chat.py
7. Restart backend

The abstraction makes this a 10-minute change.

## Questions?

See `PHASE_4_SETUP.md` for deeper architectural details.  
See `log.md` for full development history.  
See `PHASE_4B_VERIFICATION.md` for comprehensive testing checklist.
