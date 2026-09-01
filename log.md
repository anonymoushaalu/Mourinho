# The Gaffer — Development Log

Running log of changes made in this repo, updated after every prompt. Newest entry on top. Each entry covers what was asked, what changed on disk, and anything worth remembering later.

---

## 2026-08-25 — Phase 5A: Real 3D Gaffer avatar (Three.js + React Three Fiber)

**Prompt:** Replace the CSS/Framer-Motion placeholder avatar with a real chest-up 3D avatar rendered from the Blender-exported `MOU.glb`, using Three.js + React Three Fiber + drei, wired into the existing `AvatarRenderer` swap boundary. No chat/backend/knowledge changes. No facial animation, lip-sync, or Blender/Three.js work beyond this.

**Discovery (binary-parsed the GLB directly, not assumed):**
- `MOU.glb` (repo root, 5.6MB) is a full-body rigged humanoid (82 nodes, Mixamo-style skeleton, 8 SkinnedMeshes/1 skin), not a pre-cropped bust — chest-up framing had to come from camera positioning, not the asset itself
- 12 baked animation clips ship in the file, named almost 1:1 with `AvatarState` (`Avatar_Idle`, `Avatar_Listening`, `Avatar_Thinking`, `Avatar_Explaining`, `Avatar_TalkingGesture`, `Avatar_Success`, `Avatar_Waiting`, plus `Avatar_Navigate_Left/Right`, `Avatar_Saccade`, `Avatar_Blink`, `Avatar_Blink_Lashes`)
- The 10 body clips animate bone transforms only; the 2 blink clips animate morph/blendshape weights only — clean, verified split between "not facial animation" (played) and "facial animation" (skipped, out of scope)
- Verified independently: rest pose ≠ clip base pose (`LeftArm` rest rotation ~13° from identity vs. ~82° at the first keyframe of `Avatar_Idle`) — confirms a real T-pose-flash risk on first mount if no clip is applied before paint
- Character faces +Z (confirmed via eye-bone position, nose geometry, shoe mesh depth) — camera placed at positive Z, no guessing
- No embedded camera or lights in the GLB — both built from scratch in R3F
- No Draco/Meshopt compression (confirmed via `extensionsUsed`) — plain `useGLTF()` works with no extra loader config

**Dependencies added** (React-18-compatible majors, load-bearing pins — latest npm tags require React 19):
- `@react-three/fiber@^8.18.0`, `@react-three/drei@^9.122.0`, `three@^0.170.0`
- Verified clean peer tree via `npm ls` — single `react@18.3.1`, single `three@0.170.0`, no unmet peers

**Files created:**
- `client/public/models/gaffer-avatar.glb` — copy of `MOU.glb` (original left at repo root, same convention as the resume PDF)
- `client/src/components/avatar/three/avatarClips.ts` — `AvatarState → clip` map; `speaking` deliberately maps to `Avatar_TalkingGesture` not `Avatar_Explaining` (the latter animates the forearm/hand, which sit below the chest-up frame and would be invisible); `error` maps to `Avatar_Waiting` + red rim tint (no literal "error" clip exists)
- `client/src/components/avatar/three/AvatarModel.tsx` — loads via `useGLTF`, clones via `SkeletonUtils.clone` (not `Object3D.clone()` — meshes share one skeleton), owns the crossfade state machine, guards against the T-pose flash (first activation applies the pose at full weight via `mixer.update(0)` in `useLayoutEffect`, never a fade-in)
- `client/src/components/avatar/three/useChestUpCamera.ts` — computes camera fov/position/target once at runtime from measured `Head`/`Neck`/`Spine1` bone world positions (not hardcoded constants) — robust to a future re-export at a different scale
- `client/src/components/avatar/three/StudioEnvironment.tsx` — PMREM env map from three's bundled `RoomEnvironment` (deliberately not drei's CDN-fetching `<Environment preset>`, to avoid a network dependency/offline failure mode)
- `client/src/components/avatar/three/ThreeAvatarRenderer.tsx` — Canvas, three-point lighting (hemisphere ambient + warm key + cool fill + state-colored rim point light), circular medallion mask, halo, WebGL context-loss watcher
- `client/src/components/avatar/AvatarErrorBoundary.tsx` — local class-based boundary scoped to the avatar only, so a GLB/WebGL failure degrades to the placeholder instead of taking down the whole chat widget

**Files modified:**
- `client/src/components/avatar/AvatarRenderer.tsx` — now `lazy()` + `Suspense` + `AvatarErrorBoundary` around `ThreeAvatarRenderer`, with `AvatarPlaceholder` as both the loading and error fallback (same element instance for both, so the two states are pixel-identical)
- `client/src/lib/avatarStatus.ts` — added `AVATAR_STATE_GLOW_GRADIENT`/`AVATAR_STATE_GLOW_OPACITY` (moved from `AvatarPlaceholder`, zero behavior change) plus new `AVATAR_STATE_ACCENT_HEX`/`AVATAR_STATE_RIM_INTENSITY` for the 3D rim light
- `client/src/components/avatar/AvatarPlaceholder.tsx` — imports the moved maps instead of defining them locally
- `client/package.json` — three new dependencies
- `client/src/config/env.ts` — removed a dead `required()` helper left over from Phase 4A (blocked typecheck)
- `client/src/lib/chat/realChatTransport.ts` — fixed a pre-existing `noUncheckedIndexedAccess` gap in the NDJSON line-parsing loop (blocked typecheck)

**Verified (headless Chromium via Playwright, screenshots inspected):**
- Cold load: placeholder briefly, then the 3D portrait, no T-pose flash, no layout shift
- Framing: correctly chest-up, head near top with headroom, face frontal and well-lit, materials read with proper specular (not flat/plasticky) thanks to the env map
- All state transitions (idle/thinking/speaking/success/error) — halo and rim-light color change per state; error state shows the intended red tint
- 6 viewports (375/390/768/1024/1280/1440px) — zero horizontal overflow, zero console errors at any width
- `prefers-reduced-motion` — no continuous motion, but poses visibly differ between states (validates the non-zero `freezeAt` design, since all clips share an identical frame-0 pose)
- GLB-missing fallback test — placeholder renders, chat stays fully functional, top-level `ErrorBoundary` does NOT fire (confirmed via DOM check), `AvatarErrorBoundary` correctly logs and recovers
- 22x open/close cycle churn test — zero errors, exactly one canvas element afterward, no WebGL context-loss warnings
- Dark mode — medallion backdrop keeps the face legible against `dark:bg-slate-900`
- `npm run typecheck` / `npm run lint` / `npm run build` all clean; confirmed via `dist/assets/` that three/fiber/drei landed in their own lazy chunk (238KB gzip), not the entry chunk (94KB gzip)

**Known/accepted limitation:** in the deliberately-broken-GLB test only, a handful of `pageerror` (unhandled promise rejection) events surface alongside the correctly-caught React error — traced to `three`'s `GLTFLoader` promise-rejection handling, not fixable from application code without a disproportionate global `unhandledrejection` suppressor. Removed a redundant module-scope `useGLTF.preload()` call that was one source of this, but the remaining noise is upstream library behavior in an edge case (a missing production asset) that doesn't affect the real, verified-clean happy path.

---

## 2026-08-25 — Phase 4B: Migrate to Groq API

**Prompt:** Replace Groq provider (free tier). Keep all architecture, frontend, and knowledge grounding intact. Only swap the LLM provider from Gemini to Groq.

**Changes:**
- Updated `server/pyproject.toml` — replaced `google-generativeai>=0.8.0` with `groq>=0.9.0`
- Updated `server/app/core/config.py` — replaced `gemini_api_key`/`gemini_model` with `groq_api_key`/`groq_model` (default: `openai/gpt-oss-120b`)
- Rewrote `server/app/services/llm_service.py`:
  - Kept `LLMProvider` abstraction (provider-agnostic)
  - Removed `GeminiProvider`
  - Created `GroqProvider` using official Groq SDK
  - Groq's Chat Completions API with `stream=True` for real streaming
  - Parameters: `temperature=1`, `max_completion_tokens=2048`, `top_p=1`, `reasoning_effort=medium`
  - Uses ThreadPoolExecutor (Groq SDK is synchronous) to avoid blocking async loop
  - Proper handling of streaming chunks from Groq
- Updated `server/app/api/v1/routes/chat.py`:
  - Changed exception handling from `google.api_core.exceptions` to `groq` (APIError, RateLimitError)
  - Same error message strategy as before (no provider details exposed)
- Updated `server/.env.example` — `GROQ_API_KEY=` (pointing to https://console.groq.com/), `GROQ_MODEL=openai/gpt-oss-120b`
- Updated `server/.env` — local config with Groq variables

**Why Groq:**
- Free tier with generous limits (fast inference, low latency)
- Official Python SDK (`groq`) with proper streaming support
- `openai/gpt-oss-120b` model available on free tier
- Real token streaming (unlike Gemini which returns full response at once)
- Superior inference speed compared to Gemini
- Existing LLMProvider abstraction means swapping was architectural

**No changes to:**
- Frontend code (realChatTransport, transportFactory, env config)
- ChatStreamEvent contract (still discriminated union)
- Mock transport (still available)
- Portfolio knowledge grounding (system prompt unchanged)
- Knowledge service (unchanged)
- Chat UI (unchanged)

**Architecture:**
```
Groq Chat Completions (with streaming)
    ↓
GroqProvider.stream_response()
    ↓ (AsyncIterator[str])
FastAPI endpoint (generates ChatStreamEvent NDJSON)
    ↓
frontend realChatTransport (parses discriminated union)
    ↓
Avatar + Chat UI
```

**Verification steps:**
1. `pip install -e '.[dev]'` in server/ (installs groq>=0.9.0)
2. Get free API key at https://console.groq.com/
3. Edit server/.env: replace GROQ_API_KEY placeholder
4. Start backend: `uvicorn app.main:app --reload --port 8000`
5. Start frontend: `npm run dev`
6. Test with all 9+ test cases (documented in PHASE_4B_GROQ_SETUP.md)
7. Verify no API key in browser console/Network
8. Test error scenarios (invalid key, rate limit, etc.)

**Known differences from Gemini:**
- Real streaming (chunks arrive as model generates) vs. Gemini's full response at once
- `openai/gpt-oss-120b` includes reasoning capabilities (reasoning_effort=medium)
- Faster inference latency (Groq's selling point)
- Avatar state transitions happen more smoothly due to real streaming

---

## 2026-08-25 — Phase 4A: Migrate to Google Gemini API (free tier)

**Prompt:** Replace Anthropic Claude with Google's Gemini API free tier. Keep all architecture, frontend, and knowledge grounding intact. Only swap the LLM provider.

**Changes:**
- Updated `server/pyproject.toml` — replaced `anthropic>=0.38.0` with `google-generativeai>=0.8.0`
- Updated `server/app/core/config.py` — replaced `anthropic_api_key` with `gemini_api_key` and `gemini_model` (default: `gemini-2.5-flash`)
- Rewrote `server/app/services/llm_service.py`:
  - Kept `LLMProvider` abstraction (provider-agnostic)
  - Removed `ClaudeProvider`
  - Created `GeminiProvider` — wraps Google's Generative AI SDK
  - Gemini SDK is sync-only, so responses run in ThreadPoolExecutor to avoid blocking FastAPI's async loop
  - Converts Gemini's full response to word-by-word yielding (simulates streaming for frontend compatibility)
  - Updated `get_llm_provider()` factory to use GeminiProvider
- Updated `server/app/api/v1/routes/chat.py`:
  - Changed exception handling from `anthropic.APIError` to `google.api_core.exceptions.GoogleAPIError`
  - Added `TooManyRequests` handling — returns friendly "temporarily unavailable" message instead of raw API error
- Updated `server/.env.example` — `GEMINI_API_KEY=` (pointing to https://ai.google.dev/), `GEMINI_MODEL=gemini-2.5-flash`
- Updated `server/.env` — local config with Gemini variables

**Why Gemini:**
- Free tier with generous limits (60 requests/minute, suitable for dev/small projects)
- No paid API required; get key at https://ai.google.dev/ (instant)
- gemini-2.5-flash is fast and capable for portfolio Q&A
- Google's official Python SDK (`google-generativeai`) is well-documented
- Existing LLMProvider abstraction means swapping was architectural, not a major rewrite

**No changes to:**
- Frontend code (realChatTransport, transportFactory, env config)
- ChatStreamEvent contract (still discriminated union with chunk/actions/done/error)
- Mock transport (still available via VITE_USE_MOCK_TRANSPORT=true)
- Portfolio knowledge grounding (system prompt unchanged)
- Knowledge service (still uses same PortfolioKnowledge dataclass)
- Chat UI (unchanged)

**Verification steps:**
1. `pip install -e '.[dev]'` in server/ (installs google-generativeai)
2. Get free API key at https://ai.google.dev/
3. Edit server/.env: replace GEMINI_API_KEY placeholder
4. Start backend: `uvicorn app.main:app --reload --port 8000`
5. Start frontend: `npm run dev`
6. Test with all 6 example questions
7. Verify no API key in browser console/Network tab
8. Test error scenarios (invalid key, rate limit, etc.)

**Known limitations:**
- Gemini SDK is synchronous; we use ThreadPoolExecutor to avoid blocking (not ideal for very high concurrency, but fine for portfolio chatbot)
- Gemini returns full response at once; frontend sees it as streamed word-by-word (not true token streaming like Claude)
- Free tier has rate limits (60 req/min); if exceeded, user sees "temporarily unavailable"
- System prompt is sent with every request (no caching); production might optimize this

---

## 2026-08-25 — Phase 4: Real AI backend architecture

**Prompt:** Design and implement the real backend for The Gaffer using Python + FastAPI + Claude API. Keep the mock transport available. Support streaming responses. Ground all claims in portfolio knowledge (no hallucination). Maintain the existing frontend unchanged except for transport swapping.

**Backend changes:**
- Updated `server/pyproject.toml` — added `anthropic>=0.38.0` and `python-dotenv>=1.0.0` dependencies
- Updated `server/.env.example` — added `ANTHROPIC_API_KEY` variable with guidance
- Updated `server/app/core/config.py` — added `anthropic_api_key: str` field to Settings
- Created `server/app/schemas/chat.py` — request/response schemas matching frontend's ChatTransport contract (ChatRequest, NavigationAction, ChatChunk, ChatNavigationActions, ChatDone, ChatError, discriminated ChatStreamEvent union)
- Created `server/app/services/llm_service.py` — LLMProvider abstraction with ClaudeProvider implementation; supports streaming via Claude's async client; never hardcodes LLM throughout the app, allowing future swaps (Gemini, Grok, etc.)
- Created `server/app/services/knowledge_service.py` — PortfolioKnowledge dataclass ensuring responses never invent facts; get_gaffer_system_prompt() returns a comprehensive prompt that grounds Claude in documented portfolio facts (projects, achievements, education, skills) and explicitly marks missing categories (experience, internships, AI work) as "not documented"
- Created `server/app/api/v1/routes/chat.py` — POST /api/v1/chat endpoint with streaming; yields NDJSON events matching ChatStreamEvent shape; handles Claude API errors gracefully
- Updated `server/app/api/v1/router.py` — included chat router in v1 API surface
- Created `server/.env` — local development config with placeholder API key (never commit real key)

**Frontend changes:**
- Created `client/src/lib/chat/realChatTransport.ts` — real ChatTransport that calls backend's /api/v1/chat via fetch; streams NDJSON; parses ChatStreamEvent discriminated union; handles network errors, abort, and malformed responses gracefully
- Updated `client/src/config/env.ts` — made VITE_API_BASE_URL allow empty string (dev proxy), added VITE_USE_MOCK_TRANSPORT flag for choosing transport
- Updated `client/src/lib/chat/transportFactory.ts` — getChatTransport() now switches between realChatTransport (default) and mockChatTransport (if VITE_USE_MOCK_TRANSPORT=true)

**Architecture decisions:**
- LLM provider abstraction (ClaudeProvider) allows swapping providers without touching routing or knowledge layers
- System prompt embeds portfolio knowledge directly (no separate retrieval service yet) — ensures grounding and clarity for Claude's reasoning
- Streaming via NDJSON over HTTP (not WebSocket) — simpler, works through proxies, matches frontend's AsyncIterable contract
- Frontend mock transport remains functional — allows testing UI without backend, or switching for debugging
- Backend never exposes stack traces or implementation details to the browser
- Portfolio knowledge duplication (frontend TypeScript + backend Python) is acknowledged; production might share a data source, but Phase 4 prioritizes simplicity and backend independence

**Verification steps still needed:**
1. Server dependencies installed (`pip install -e '.[dev]'` or similar)
2. ANTHROPIC_API_KEY configured in server/.env
3. Backend runs on http://localhost:8000 (uvicorn app.main:app --reload)
4. Frontend runs on http://localhost:5173
5. Test all 6 example questions through real backend
6. Verify avatar state transitions (thinking → speaking → complete → idle)
7. Confirm no API key exposure in browser console/network tab
8. Test error scenarios: backend down, API key invalid, timeout
9. Verify mock transport still works when VITE_USE_MOCK_TRANSPORT=true

---

## 2026-08-20 — Logging setup

**Prompt:** Set up a logger file (`log.md`) that gets updated after every prompt, including file structure and related context.

**Files changed:**
- Created: `log.md` (this file), backfilled with Phases 1–3

**Notes:** Going forward, this file gets a new entry appended after each prompt that changes the repo. Entries are terse — prompt summary, file diffs, notable decisions — not a full transcript.

---

## Phase 3 — Portfolio knowledge layer

**Prompt:** Use the real resume (`resume_jabez (3).pdf`, repo root) as the authoritative content source for The Gaffer's mock knowledge base. Discover and structure: about, education, skills, projects, experience, internships, hackathons, blockchain/Web3 work, AI work, achievements, GitHub, navigation targets, public contact info. Don't invent anything; mark gaps unknown.

**Discovery findings (from the resume, nothing invented):**
- **Present:** identity/location, LICET CS undergrad (Sept 2023–present), stated skills (Java/Python/C, React/Next/Node), 5 projects, 3 named achievements/hackathons, GitHub, email, phone
- **Absent (marked `null` in the type, not fabricated):** no Experience or Internships section exists at all; no AI/ML work mentioned anywhere; portfolio site listed literally as "[WORKING]" — not live
- Blockchain/Web3 work: Cross-Chain Freelance Escrow Platform (primary — Solidity/Hardhat/OpenZeppelin/LI.FI, deployed Base Sepolia) + Skillexify (NFTs/smart contracts/zkTLS, hackathon "Participation")
- One deliberate judgment call: phone number is in the data model (`contact.phonePublic: false`) but never surfaced in any bot reply — only email + GitHub are used as public contact channels

**Files changed:**
- Created: `client/src/types/portfolio.ts` (`PortfolioProject`, `PortfolioAchievement`, `PortfolioKnowledge` types)
- Created: `client/src/data/portfolioKnowledge.ts` (the transcribed resume content)
- Created: `client/src/lib/chat/knowledgeReplies.ts` (`answerFromKnowledge()` — pattern-matches questions against the knowledge base; every sentence traces to a real field)
- Created: `client/public/resume-jabez.pdf` (copied from repo root so "View resume" is a real, working link instead of a 404)
- Modified: `client/src/lib/chat/mockChatTransport.ts` — delegates to `answerFromKnowledge()` instead of the old generic keyword matcher
- Modified: `client/src/data/suggestedQuestions.ts` — chips now the 6 real example questions ("Who is Jabez?", "Show me his blockchain projects.", etc.)
- Modified: `client/src/types/index.ts` — barrel now exports `portfolio.ts`

**Verified:** all 6 example questions produce grounded replies with working navigation actions (GitHub/project links/resume/email), zero console errors, phone number confirmed absent from all rendered output, typecheck/lint/build all clean. Caught and fixed a real bug mid-verification: "Who is Jabez?" originally read "currently a current undergraduate..." (redundant phrasing) — fixed.

**Deliberately not done:** did not expand the `ChatTransportMessage`/`ChatStreamEvent` wire contract from Phase 1 — running real content through it confirmed the existing shape (chunk/navigation-actions/done/error) already covers everything needed. Avoided adding speculative fields (citations, confidence scores) before an LLM/retrieval approach is chosen.

---

## Phase 2 — Avatar architecture

**Prompt:** Build the production-ready avatar architecture (not the real Blender/GLB/Three.js avatar yet) — a replaceable `AvatarRenderer` boundary, 6-state avatar (`idle/listening/thinking/speaking/success/error`), connected to chat state via a `useAvatarState` hook, with accessibility (keyboard, focus, aria, non-color-only state signaling) and `prefers-reduced-motion` support. Explicitly forbidden: installing Three.js/R3F, loading model.glb, touching Blender, backend/API work.

**Files changed:**
- Created: `client/src/components/avatar/AvatarRenderer.tsx` (renamed from `AvatarStage.tsx`; documents the future `ThreeAvatarRenderer` swap plan)
- Created: `client/src/components/avatar/AvatarButton.tsx` (avatar-as-button, replaces the old badge + separate icon-button pairing)
- Created: `client/src/components/avatar/AvatarStatus.tsx` (visible status dot + text, `aria-live`)
- Created: `client/src/hooks/useAvatarState.ts` (the 6-state machine; timed success/error flashes — 1.4s / 2.2s)
- Created: `client/src/lib/avatarStatus.ts` (shared state-label/color constants)
- Modified: `client/src/types/avatar.ts` — `AvatarState` extended to 6 values; split into `AvatarRendererProps` (external) / `AvatarImplementationProps` (internal, carries `isActive`)
- Modified: `client/src/components/avatar/AvatarPlaceholder.tsx` — success/error visuals, reduced-motion handling
- Modified: `client/src/hooks/useChatSession.ts` — no longer computes avatar state itself; exposes raw `inputActive` + `lastMessageStatus` instead
- Modified: `client/src/components/GafferWidget.tsx` — wires `useChatSession` + `useAvatarState` together (the one connection point)
- Modified: `client/src/components/chat/ChatWidget.tsx` — uses `AvatarButton`; defines `GafferSessionProps`
- Modified: `client/src/components/chat/ChatPanel.tsx` — uses `AvatarRenderer` + `AvatarStatus` in the header
- Modified: `client/src/components/ui/IconButton.tsx` — explicit `focus-visible` ring
- Modified: `client/src/lib/chat/mockChatTransport.ts` — added a dev-only error-trigger keyword ("error" in the message) so the error state is actually testable pre-backend
- Deleted: `client/src/components/avatar/AvatarStage.tsx` (renamed), `client/src/components/chat/ChatToggleButton.tsx` (superseded)

**Verified:** full state-machine walkthrough via headless Chromium — listening/thinking/speaking/success (caught precisely at t≈2s, held ~1.4s)/error all confirmed both in DOM state and screenshots; responsive sweep across 375/390/768/1024/1280/1440px (avatar never overlaps input, checked via bounding-box math); `prefers-reduced-motion: reduce` swaps animated rings for static ones; keyboard Tab reaches the avatar button first with a visible focus ring, Enter opens the panel. `npm run build`/`typecheck`/`lint` all clean.

---

## Phase 1 — Frontend shell

**Prompt:** Build The Gaffer's chatbot frontend shell — chat UI, floating avatar placeholder, suggested questions, streaming message UI, navigation-action UI, responsive/mobile — as a standalone-feeling widget, explicitly not yet wired to Blender/Three.js/a real backend/AI API. Decided to build inside the existing `mourinho/client` workspace rather than a new repo.

**Stack added:** Tailwind CSS v4 (`@tailwindcss/vite`, zero config files), Framer Motion, Lucide React.

**Files created** (full list — this was the initial scaffold):
- `client/src/types/{avatar,chat,chat-transport,navigation-action,suggestion,index}.ts`
- `client/src/data/suggestedQuestions.ts`
- `client/src/lib/cn.ts`, `client/src/lib/chat/{mockChatTransport,transportFactory}.ts`
- `client/src/hooks/{useChatSession,useAutoScroll,useMediaQuery}.ts`
- `client/src/components/chat/{ChatWidget,ChatPanel,MessageList,MessageBubble,TypingIndicator,ChatInput,ChatToggleButton}.tsx`
- `client/src/components/avatar/{AvatarStage,AvatarPlaceholder}.tsx`
- `client/src/components/suggestions/{SuggestedQuestions,SuggestionChip}.tsx`
- `client/src/components/navigation/{NavigationActionList,NavigationActionButton}.tsx`
- `client/src/components/ui/{IconButton,VisuallyHidden}.tsx`
- `client/src/components/GafferWidget.tsx`

**Files modified:** `client/src/app/App.tsx` (renders `<GafferWidget />`), `client/src/styles/global.css` (Tailwind import), `client/vite.config.ts` (Tailwind plugin), `client/package.json` (new deps)

**Key architectural seams established:**
- `ChatTransport` interface (`send(message, signal): AsyncIterable<ChatStreamEvent>`) — the mock/real-backend swap point, isolated in `transportFactory.ts`
- `AvatarState`-driven avatar slot — the placeholder/Three.js swap point (later formalized as `AvatarRenderer` in Phase 2)

**Verified:** desktop open/close, streaming reply rendering, mobile full-screen layout, zero console errors — via headless Chromium screenshots.

---

## Current file structure (`client/src/`, as of Phase 3)

```
app/
  App.tsx
  ErrorBoundary.tsx
components/
  GafferWidget.tsx
  avatar/
    AvatarButton.tsx
    AvatarPlaceholder.tsx
    AvatarRenderer.tsx
    AvatarStatus.tsx
  chat/
    ChatInput.tsx
    ChatPanel.tsx
    ChatWidget.tsx
    MessageBubble.tsx
    MessageList.tsx
    TypingIndicator.tsx
  navigation/
    NavigationActionButton.tsx
    NavigationActionList.tsx
  suggestions/
    SuggestedQuestions.tsx
    SuggestionChip.tsx
  ui/
    IconButton.tsx
    VisuallyHidden.tsx
config/
  env.ts
data/
  portfolioKnowledge.ts
  suggestedQuestions.ts
hooks/
  useAutoScroll.ts
  useAvatarState.ts
  useChatSession.ts
  useMediaQuery.ts
lib/
  api/client.ts
  avatarStatus.ts
  chat/
    knowledgeReplies.ts
    mockChatTransport.ts
    transportFactory.ts
  cn.ts
main.tsx
styles/
  global.css
types/
  avatar.ts
  chat-transport.ts
  chat.ts
  index.ts
  navigation-action.ts
  portfolio.ts
  suggestion.ts
vite-env.d.ts
```

**Not yet built:** real 3D avatar (`ThreeAvatarRenderer` + React Three Fiber + model.glb — Phase 4), real backend/LLM (Phase 3 continuation), auth, database.
