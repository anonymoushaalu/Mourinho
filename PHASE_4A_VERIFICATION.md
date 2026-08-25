# Phase 4A Verification Checklist

Complete this checklist to verify the Gemini migration is working correctly.

## Pre-Flight

- [ ] Python 3.11+ installed (`python --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Free Gemini API key obtained from https://ai.google.dev/
- [ ] `.env` file created in `server/` with `GEMINI_API_KEY` filled in
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

### Test 2: Question 1 — "Who is Jabez?"

1. Click chip: "Who is Jabez?"
2. Watch avatar:
   - `listening` (input focused)
   - `thinking` (message sent)
   - `speaking` (response streaming)
   - `complete` (response done)
   - `idle` (back to rest)
3. Verify response contains:
   - Name: "Jabez Ananias Paul"
   - Location: "Chennai" or "Tamil Nadu"
   - Education: "LICET" and "CS"
   - No invented information

- [ ] Avatar state transitions correctly
- [ ] Response text streams (not instant)
- [ ] Response is grounded in portfolio knowledge
- [ ] No errors in browser console

### Test 3: Question 2 — "Show me his blockchain projects."

Expected: Cross-Chain Escrow + Skillexify with tech stacks

- [ ] Response mentions blockchain projects
- [ ] Tech stacks listed (Solidity, Hardhat, etc.)
- [ ] No hallucinated projects
- [ ] Avatar completes and returns to idle

### Test 4: Question 3 — "What technologies does he know?"

Expected: Java, Python, C, React, Next.js, Node.js, etc.

- [ ] Mentions stated languages
- [ ] Mentions frameworks from resume
- [ ] Notes 6 spoken languages
- [ ] Grounded in portfolio

### Test 5: Question 4 — "Why should I hire him?"

Expected: Top 15 at CTRLALTHACK, accessibility score 65→95, Solidity contracts deployed

- [ ] Mentions specific achievements
- [ ] References concrete metrics
- [ ] Notes undergrad status (context for hiring)
- [ ] Grounded in resume

### Test 6: Question 5 — "Take me to his projects."

Expected: Lists all 5 projects with summaries

- [ ] All 5 projects listed
- [ ] Summaries provided
- [ ] No invented projects
- [ ] Portfolio site note: "not live yet"

### Test 7: Question 6 — "I want to contact him."

Expected: Email + GitHub (never phone)

- [ ] Email provided: jbzanspal@gmail.com
- [ ] GitHub URL provided
- [ ] No phone number exposed
- [ ] Action buttons functional

- [ ] Email action link works (mailto:)
- [ ] GitHub action link works (opens GitHub)

### Test 8: Undocumented Content

Ask: "What's his work experience?" or "Tell me about his AI projects."

Expected: "That's not documented on his resume" or similar

- [ ] Response acknowledges missing information
- [ ] No hallucination
- [ ] Doesn't pretend to know undocumented details

### Test 9: Unrelated Question

Ask: "What's the capital of France?" or "How do I bake a cake?"

Expected: Gaffer redirects to portfolio topics or says it's not relevant

- [ ] Response acknowledges out-of-scope question
- [ ] Offers to discuss portfolio instead
- [ ] Doesn't answer with completely off-topic info

## Security Verification

### No API Key Exposure

1. Open DevTools (F12)
2. Go to Network tab
3. Ask any question in The Gaffer
4. Click on the `POST /api/v1/chat` request
5. Inspect **Request** and **Response** headers and body

- [ ] No `GEMINI_API_KEY` in request headers
- [ ] No API key in request body
- [ ] No API key in response body
- [ ] No API key in browser console (search for "AIza")

### Backend Logging

From the server terminal, verify logs show:

```
INFO:     POST /api/v1/chat
```

- [ ] No API key appears in server logs
- [ ] No raw error messages exposed to browser
- [ ] Generic error messages only ("The Gaffer encountered an error...")

## Error Scenarios

### Test Error 1: Invalid/Expired API Key

Edit `server/.env`: Change `GEMINI_API_KEY=` to an invalid value (e.g., `fake-key`)

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
- [ ] Error message: "Failed to reach the backend..." (frontend error, not backend)
- [ ] UI remains responsive

### Test Error 3: Rate Limiting (optional, advanced)

To trigger rate limiting, send 60+ requests in <1 minute:

```bash
for i in {1..70}; do
  curl -X POST http://localhost:8000/api/v1/chat \
    -H "Content-Type: application/json" \
    -d '{"content":"Who is Jabez?"}'
done
```

- [ ] After 60 requests, backend returns rate limit error
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
- [ ] No API calls to backend
- [ ] Avatar state transitions occur
- [ ] Response is grounded in mock knowledge

## Cleanup

After verification:

- [ ] Revert `VITE_USE_MOCK_TRANSPORT` to default (real backend)
- [ ] Restore correct `GEMINI_API_KEY` in `server/.env`
- [ ] Delete any test commits or branches
- [ ] Review git status: only intended files changed

## Sign-Off

All checks passed:

- [ ] Frontend works with real backend
- [ ] API key is not exposed
- [ ] Error handling is graceful
- [ ] Mock transport is functional
- [ ] Code quality checks pass
- [ ] No regressions from Phase 3/4

**Phase 4A Migration: COMPLETE ✅**

---

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `ModuleNotFoundError: google.generativeai` | Dependencies not installed | `pip install -e '.[dev]'` in `server/` |
| 401 Unauthorized from Gemini | Invalid API key | Check `GEMINI_API_KEY` in `server/.env` |
| Frontend shows "network error" | Backend not running | Start backend: `uvicorn app.main:app --reload --port 8000` |
| CORS error in browser | CORS not configured | Check `CORS_ORIGINS` in `server/.env` includes `http://localhost:5173` |
| "Rate limit" error frequently | Free tier exhausted | Wait 1 minute; free tier is 60 req/min; upgrade tier if needed |
| Typecheck fails | Type mismatches | Run `npm run typecheck` and fix errors |
| No text streaming (instant response) | Gemini limitation | Expected behavior; Gemini returns full response at once, yielded word-by-word |
| Empty responses | System prompt issue | Check `knowledge_service.py` system prompt is correct |
| "Avatar" not visible | CSS/rendering issue | Check browser console for errors; try clearing cache |

## Next Steps

If all checks pass:

1. **Commit changes** with message referencing Phase 4A
2. **Document the setup** (send user PHASE_4A_GEMINI_SETUP.md)
3. **Next phase:** Phase 5 would be Blender/Three.js integration (out of scope for this prompt)

If issues remain, troubleshoot using the table above or provide specific error messages.
