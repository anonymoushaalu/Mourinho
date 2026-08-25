# Phase 4A — Gemini API Setup

**Changed from:** Anthropic Claude API  
**Changed to:** Google Gemini API (free tier)

This is a **drop-in replacement** — all frontend code, knowledge grounding, and ChatTransport contracts remain unchanged.

## Quick Start

### 1. Get a Free Gemini API Key

Go to: https://ai.google.dev/

Click **"Get API Key"** → Create a new project → Copy the key

(No credit card required for free tier)

### 2. Install Updated Dependencies

From the `server/` directory:

```bash
pip install -e '.[dev]'
```

This installs `google-generativeai>=0.8.0` (replaces `anthropic`).

### 3. Configure the Backend

Edit `server/.env`:

```bash
GEMINI_API_KEY=AIzaSy...YOUR_KEY_HERE...
GEMINI_MODEL=gemini-2.5-flash
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
| API Provider | Anthropic Claude | Google Gemini | Free tier, no credit card |
| SDK | `anthropic>=0.38.0` | `google-generativeai>=0.8.0` | Official Google SDK |
| Config Keys | `ANTHROPIC_API_KEY` | `GEMINI_API_KEY`, `GEMINI_MODEL` | Model is configurable |
| LLMProvider | `ClaudeProvider` | `GeminiProvider` | Abstraction preserved |
| Frontend | N/A | **No changes** | realChatTransport, ChatTransport, mock transport all unchanged |
| Knowledge Grounding | N/A | **No changes** | System prompt, portfolio knowledge, response format identical |

## Architecture

```
Browser
    ↓ (fetch /api/v1/chat)
FastAPI (:8000)
    ↓ (LLMProvider abstraction)
GeminiProvider
    ↓ (google-generativeai SDK)
Google Gemini API
    ↓ (returns full response)
Backend
    ↓ (yields word-by-word for streaming illusion)
NDJSON ChatStreamEvent stream
    ↓
Frontend realChatTransport
    ↓ (parses same discriminated union)
Avatar + Chat UI
```

**Key point:** The frontend doesn't know Gemini replaced Claude. All contracts are preserved.

## Gemini Free Tier Limits

- **60 requests per minute**
- **1 million tokens per day** (across all requests)
- Requests are rate-limited, not blocked — when limit is hit, user sees: `"I'm temporarily unavailable. Please try again in a little while."`

For a portfolio chatbot, this is more than enough. Production deployments can upgrade to paid tier.

## Error Handling

### Invalid API Key

```
Error initializing Gemini: Invalid API key
```

→ Check `GEMINI_API_KEY` in `server/.env`

### Rate Limited

```json
{"type":"error","error":{"code":"rate_limit","message":"I'm temporarily unavailable. Please try again in a little while."}}
```

→ Wait a minute and retry (free tier: 60 req/min)

### Network Error

```json
{"type":"error","error":{"code":"llm_error","message":"The Gaffer encountered an error while thinking. Please try again."}}
```

→ Check internet connection; verify API key

## Verification

1. Open http://localhost:5173
2. Click avatar → ask "Who is Jabez?"
3. Check **DevTools Network tab** → `POST /api/v1/chat`
   - Request body: `{"content":"Who is Jabez?"}`
   - **Verify:** No `GEMINI_API_KEY` in request (stays on backend only)
4. Watch avatar state: `idle` → `listening` → `thinking` → `speaking` → `complete` → `idle`
5. Verify text streams incrementally (word-by-word, not true token streaming)

## Switching to Mock Transport (for testing without backend)

```bash
VITE_USE_MOCK_TRANSPORT=true npm run dev
```

This uses Phase 3's mock knowledge layer. Useful for:
- Testing frontend without backend
- Debugging without burning API quota
- Ensuring UI works offline

## Why Gemini?

✅ **Free** — No credit card required  
✅ **Easy setup** — Get key in 30 seconds  
✅ **Fast** — gemini-2.5-flash is optimized for latency  
✅ **Capable** — Handles portfolio Q&A excellently  
✅ **Official SDK** — Maintained by Google  

## Production Notes

For production deployments:

1. Move `GEMINI_API_KEY` to a secrets manager (AWS Secrets Manager, Vault, etc.)
2. Use a reverse proxy (nginx, Cloudflare) to enforce rate limits
3. Cache frequently asked questions to reduce API usage
4. Monitor API costs: `google-generativeai` logs token usage
5. Consider upgrading to a paid tier if usage exceeds free limits

## Reverting to Claude (if needed)

If you want to switch back to Claude:

1. `pip install anthropic>=0.38.0`
2. Update `server/app/core/config.py` — change `gemini_api_key` back to `anthropic_api_key`
3. Create `ClaudeProvider` class in `server/app/services/llm_service.py` (see git history)
4. Update `get_llm_provider()` factory
5. Update `server/.env`
6. Restart backend

The abstraction makes this a 10-minute change.

## Questions?

See `PHASE_4_SETUP.md` for deeper architectural details.  
See `log.md` for full development history.
