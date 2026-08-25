# Phase 4B Verification Checklist

Complete this checklist to verify the Groq migration is working correctly.

## Pre-Flight

- [ ] Python 3.11+ installed (`python --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Free Groq API key obtained from https://console.groq.com/
- [ ] `.env` file created in `server/` with `GROQ_API_KEY` filled in
- [ ] Dependencies installed: `pip install -e '.[dev]'` (from `server/`)

## Backend Startup

```bash
cd server
uvicorn app.main:app --reload --port 8000
```

Expected output:
```
INFO:     Application startup complete
Uvicorn running on http://127.0.0.1:8000
```

- [ ] Backend starts without errors
- [ ] `/docs` endpoint accessible at http://localhost:8000/docs
- [ ] No "Invalid API key" or "ModuleNotFoundError" messages
- [ ] No import errors related to groq SDK

## Frontend Startup

In a new terminal, from repo root:

```bash
npm run dev
```

Expected output:
```
  ➜  Local:   http://localhost:5173/
```

- [ ] Frontend starts without errors
- [ ] No TypeScript errors in console
- [ ] No network errors (CORS should work via Vite proxy)

## Browser Testing

### Test 1: Basic Interaction

1. Open http://localhost:5173
2. Click the avatar button (bottom-right, blue circle)
3. Observe: Panel opens with suggested questions
4. Avatar state: `idle` → `listening` (panel opens)
5. Check: 6 suggested question chips visible

- [ ] Panel opens correctly
- [ ] All 6 chips visible
- [ ] Avatar button works as expected

### Test 2: Real Streaming

1. Click chip: "Who is Jabez?"
2. Watch the response text appear incrementally (real streaming, not all at once)
3. Verify avatar state transitions: `listening` → `thinking` → `speaking` → `complete` → `idle`

**Key difference from Gemini:** Text should appear word-by-word in real-time, not suddenly all at once.

- [ ] Text streams incrementally (true token streaming)
- [ ] Avatar state transitions are smooth
- [ ] Response completes within reasonable time (should be fast with Groq)
- [ ] No console errors

### Test 3: Question 1 — "Who is Jabez?"

Expected: Name, location, education, work areas mentioned

- [ ] Response mentions "Jabez Ananias Paul"
- [ ] Mentions "Chennai" or "Tamil Nadu"
- [ ] Mentions "LICET" and CS
- [ ] Mentions portfolio areas (web, blockchain, security, etc.)
- [ ] No invented information
- [ ] Avatar completes and returns to idle

### Test 4: Question 2 — "What are his strongest projects?"

Expected: Highlights key projects with concrete details

- [ ] Response mentions Cross-Chain Escrow Platform
- [ ] Mentions measurable achievements (accessibility 65→95)
- [ ] Mentions Solidity deployment on testnet
- [ ] Grounded in resume, not hallucinated

### Test 5: Question 3 — "Tell me about his blockchain projects."

Expected: Blockchain work (Cross-Chain Escrow, Skillexify, etc.)

- [ ] Response focuses on blockchain-specific work
- [ ] Mentions Solidity, Hardhat, smart contracts
- [ ] Provides technical details
- [ ] No invented projects

### Test 6: Question 4 — "What technologies does he use?"

Expected: Stated languages + frameworks seen in projects

- [ ] Lists Java, Python, C (stated languages)
- [ ] Lists React, Next.js, Node.js (frameworks)
- [ ] Mentions Solidity for blockchain
- [ ] Notes 6 spoken languages
- [ ] Grounded in resume

### Test 7: Question 5 — "How can I contact Jabez?"

Expected: Email + GitHub (never phone)

- [ ] Email provided: jbzanspal@gmail.com
- [ ] GitHub URL provided: https://github.com/dihtoyourcrack
- [ ] No phone number exposed
- [ ] Action buttons functional

- [ ] Email action link works (mailto:)
- [ ] GitHub action link works (opens GitHub)

### Test 8: Question 6 — "Show me his GitHub."

Expected: GitHub link or direction

- [ ] Response acknowledges GitHub as main portfolio
- [ ] Provides correct GitHub URL
- [ ] Action button to open GitHub works

### Test 9: Question 7 — "Show me his resume."

Expected: Resume link

- [ ] Response offers resume link
- [ ] Action button works
- [ ] PDF opens when clicked

### Test 10: Question 8 — "Take me to his projects."

Expected: Project list

- [ ] Lists all 5 projects
- [ ] Mentions live projects (JabariRao, Skillexify)
- [ ] Notes portfolio site not live yet
- [ ] Provides project links where available

### Test 11: Undocumented Content

Ask: "What's his work experience?" or "Tell me about his AI projects."

Expected: "That's not documented..." or similar honest response

- [ ] Response acknowledges missing information
- [ ] Doesn't hallucinate or pretend to know
- [ ] Offers alternative information (GitHub, resume)

### Test 12: Unrelated Question

Ask: "What's the capital of France?" or "How do I bake a cake?"

Expected: Gaffer redirects to portfolio topics

- [ ] Response acknowledges out-of-scope
- [ ] Offers to discuss portfolio instead
- [ ] Doesn't answer with off-topic information

## Streaming Performance

1. Ask a question and observe timing
2. Response should start appearing within 1-2 seconds (Groq is fast)
3. Full response should complete within 5-10 seconds typically

- [ ] Initial response latency <2s
- [ ] Full response generation <10s
- [ ] Text appears incrementally (true streaming)
- [ ] No buffering or delays

## Security Verification

### No API Key Exposure

1. Open DevTools (F12)
2. Go to Network tab
3. Ask any question in The Gaffer
4. Click on the `POST /api/v1/chat` request
5. Inspect **Request** and **Response** headers and body

- [ ] No `GROQ_API_KEY` in request headers
- [ ] No API key in request body
- [ ] No API key in response body
- [ ] No API key in browser console (search for "gsk_")

### Backend Logging

From the server terminal, verify logs show:

```
INFO:     POST /api/v1/chat
```

- [ ] No API key appears in server logs
- [ ] No raw error messages exposed to browser
- [ ] Generic error messages only

## Error Scenarios

### Test Error 1: Invalid/Expired API Key

Edit `server/.env`: Change `GROQ_API_KEY=` to an invalid value (e.g., `fake-key`)

1. Restart backend
2. Ask a question
3. Expected: Error response

- [ ] Frontend receives error event
- [ ] Avatar enters `error` state (briefly)
- [ ] Error message: "The Gaffer encountered an error..." (generic, no API details)
- [ ] User can retry

### Test Error 2: Backend Down

1. Stop the backend server (Ctrl+C)
2. Ask a question in the frontend
3. Expected: Network error

- [ ] Frontend receives network error
- [ ] Avatar enters `error` state
- [ ] Error message about backend unavailable
- [ ] UI remains responsive

### Test Error 3: Rate Limiting (optional, advanced)

To trigger rate limiting, send 35+ requests in <1 minute:

```bash
for i in {1..40}; do
  curl -X POST http://localhost:8000/api/v1/chat \
    -H "Content-Type: application/json" \
    -d '{"content":"Who is Jabez?"}'
done
```

- [ ] After ~30 requests, backend returns rate limit error
- [ ] Frontend shows: "I'm temporarily unavailable. Please try again in a little while."
- [ ] No raw API errors exposed

## Code Quality

### TypeScript Check (Frontend)

```bash
npm run typecheck
```

- [ ] No TypeScript errors
- [ ] No new warnings

### Linting (Frontend)

```bash
npm run lint
```

- [ ] No linting errors
- [ ] No new warnings

### Type Check (Backend)

```bash
cd server
mypy app
```

- [ ] No mypy errors
- [ ] All type hints correct

### Ruff Lint (Backend)

```bash
cd server
ruff check app
```

- [ ] No linting errors

### Build (Frontend)

```bash
npm run build
```

- [ ] Build succeeds
- [ ] No errors or warnings
- [ ] `dist/` folder created with assets

## Mock Transport (Regression)

Verify existing mock transport still works:

```bash
VITE_USE_MOCK_TRANSPORT=true npm run dev
```

1. Open http://localhost:5173
2. Ask a question (backend is ignored)
3. Response uses Phase 3's mock knowledge

- [ ] Mock transport works
- [ ] No API calls to Groq backend
- [ ] Avatar state transitions occur
- [ ] Response is grounded in mock knowledge

## Cleanup

After verification:

- [ ] Revert `VITE_USE_MOCK_TRANSPORT` to default (real backend)
- [ ] Restore correct `GROQ_API_KEY` in `server/.env`
- [ ] Delete any test commits or branches
- [ ] Review git status: only intended files changed

## Sign-Off

All checks passed:

- [ ] Frontend works with real Groq backend
- [ ] API key is not exposed
- [ ] Error handling is graceful
- [ ] Mock transport is functional
- [ ] Real streaming is working (not word-by-word simulation)
- [ ] Code quality checks pass
- [ ] No regressions from Phase 4A/Phase 3

**Phase 4B Migration: COMPLETE ✅**

---

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `ModuleNotFoundError: groq` | Dependencies not installed | `pip install -e '.[dev]'` in `server/` |
| 401 Unauthorized from Groq | Invalid API key | Check `GROQ_API_KEY` in `server/.env` |
| Frontend shows "network error" | Backend not running | Start backend: `uvicorn app.main:app --reload --port 8000` |
| CORS error in browser | CORS not configured | Check `CORS_ORIGINS` in `server/.env` includes `http://localhost:5173` |
| "Rate limit" error frequently | Free tier exhausted (30 req/min) | Wait 1 minute; upgrade tier if needed |
| Typecheck fails | Type mismatches | Run `npm run typecheck` and fix errors |
| No text streaming (instant response) | API call succeeded but streaming failed | Check server logs; verify API key is valid |
| Empty responses | System prompt or model issue | Check `knowledge_service.py` system prompt is correct |
| Very slow responses | Groq API overloaded or network latency | Groq should be fast; check network; retry |
| Avatar state doesn't transition | Chat state or transport issue | Check browser console for errors; verify backend is running |

## Next Steps

If all checks pass:

1. **Commit changes** with message referencing Phase 4B
2. **Document the setup** (send user PHASE_4B_GROQ_SETUP.md)
3. **Next phase:** Phase 5 would be Blender/Three.js integration (out of scope for this prompt)

If issues remain, troubleshoot using the table above or provide specific error messages.
