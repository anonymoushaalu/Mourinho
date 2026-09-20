# The Gaffer — Development Log

Running log of changes made in this repo, updated after every prompt. Newest entry on top. Each entry covers what was asked, what changed on disk, and anything worth remembering later.

---

## 2026-09-20 — Phase 6A: Voice output (text-to-speech)

**Prompt:** Commit and push the frontend work, then start Phase A of the roadmap: TTS voice output, with a speaker toggle so The Gaffer talks back.

**Discovery that reshaped the plan:** the originally-assumed model, `playai-tts`, has been **decommissioned server-side** by Groq — confirmed via a live API call (`model_decommissioned` error), even though the installed SDK's own type hints still list it as valid. Queried `client.models.list()` live to find the actual replacement: Canopy Labs' **`canopylabs/orpheus-v1-english`**. That model then turned out to need its *own* separate terms acceptance (distinct from whatever "PlayAI TTS" terms were accepted earlier) — confirmed via another live call returning `model_terms_required`, pointing at a specific console URL. Per the user's choice, built the full backend/frontend against Orpheus's confirmed-correct API shape, with tests using a mocked provider (same pattern as chat/transcription) rather than blocking on that acceptance.

**Consequence:** the actual TTS **voice name** (as opposed to the model id) is genuinely unverified — Groq's voice roster for Orpheus isn't accessible without accepting those terms first, and guessing one risked shipping a confident-looking default that silently fails for an unrelated reason (wrong voice vs. terms-not-accepted are hard to tell apart without a live call). `GROQ_TTS_VOICE` was deliberately left with **no default** (`str | None = None`), scoped so only `/voice/speak` is affected — chat and voice input work fully without it. The route checks this first and returns a clear `speech_not_configured` (503) error rather than a confusing upstream failure.

**Files created:**
- `server/tests/test_voice_speak.py` — 11 tests. Needed a `tts_configured` fixture using FastAPI's `dependency_overrides` to get past the "not configured" check for tests that need to reach the (mocked) provider — the session-scoped `settings` fixture in `conftest.py` doesn't actually reach route-level `Depends(get_settings)` calls (a pre-existing characteristic noted here, not fixed — out of scope)
- `client/src/hooks/useVoiceOutput.ts` — fetches and plays TTS audio via `HTMLAudioElement` + `URL.createObjectURL`. Applies the same discipline the Phase 5E audit established on the recording side: an `abortController`-per-request pattern (new `speak()` call aborts any in-flight one), and `releaseAudio()` on stop/unmount/error that revokes the object URL and clears the audio element — the exact class of leak the audit found and fixed for `MediaStream`, applied proactively here rather than waiting for another audit to catch it later

**Files modified:**
- `server/app/core/config.py` — `groq_tts_model` (defaults to the verified Orpheus id), `groq_tts_voice` (no default, see above)
- `server/app/core/errors.py` — `SpeechServiceError` (502, upstream failure) and `SpeechNotConfiguredError` (503, deploy/config gap) — kept distinct since the caller can't fix a 503 by retrying
- `server/app/schemas/voice.py` — `SpeakRequest { text }`, capped at 2000 chars (matches `ChatRequest.content`'s existing limit; the real Orpheus limit is unverified, so this is a defensive client-side cap, not a claimed authoritative one)
- `server/app/services/voice_service.py` — added `SpeechProvider`/`GroqSpeechProvider`/`get_speech_provider` alongside the existing `VoiceProvider` (STT), kept as a separate interface rather than merged — genuinely different capabilities that share a domain and a vendor, not one capability with two methods
- `server/app/api/v1/routes/voice.py` — `POST /voice/speak`, returns raw `audio/mpeg` bytes (not JSON — avoids ~33% base64 overhead, directly usable by an `<audio>` element), maps `RateLimitError`/`BadRequestError`/`APIError` the same way the other two voice/chat routes do
- `server/.env.example`, `docs/environment.md` — documented `GROQ_TTS_MODEL`/`GROQ_TTS_VOICE`, including the terms-acceptance link
- `client/src/lib/voice/voiceTransport.ts` — added `speakText()`, same discriminated-result shape as `transcribeAudio()`; success path reads `response.blob()` instead of `.json()` since only the error path is JSON here
- `client/src/components/GafferWidget.tsx` — composes `useVoiceOutput` (it's UI-agnostic, doesn't know about chat messages) and owns the one effect that decides *when* to call `speak()`: on a newly-completed assistant message, only while enabled, tracked via a `lastSpokenMessageIdRef` so re-renders don't re-speak. `react-hooks/exhaustive-deps` flagged my first attempt at hand-picking dependencies (`voiceOutput.enabled`/`voiceOutput.speak`) and wanted the whole `voiceOutput` object instead — deferred to the linter rather than fighting it, since the effect's own ref-guard already makes any extra re-runs a no-op
- `client/src/components/chat/ChatWidget.tsx`, `ChatPanel.tsx` — threaded `voiceOutput` through; added a speaker/mute toggle in the header (`Volume2`/`VolumeX`, `aria-pressed`), **off by default** so audio never starts unprompted, plus an error banner matching `ChatInput`'s existing voice-error style

**Verification:** 40/40 backend tests passing (29 existing + 11 new), ruff/mypy at the established baseline (one new `B008` matching the same pattern the other three routes already have, zero other new findings). Backend contract verified live via direct `curl` calls (503 for unconfigured, 422 for empty text, all 5 routes present in `/openapi.json`) — a real, structured HTTP check, not a guess. Frontend: typecheck/lint/build all clean.

**Not verified this session:** a live browser check of the toggle/error-banner rendering and actual audio playback. Two independent Playwright/Chromium installs on this machine turned out broken (a stale `node_modules/playwright` missing its entry point in one location; a version-mismatched cached install with no downloaded browser binary in another) and a background reinstall attempt stalled with no output. Given the backend is verified at the HTTP contract level and the frontend JSX is simple, direct conditional rendering (no state-machine complexity outside the already-reasoned-through hook), relied on typecheck/lint/build plus manual code review instead of forcing a screenshot. Real end-to-end audio playback also still needs `GROQ_TTS_VOICE` set, which needs the Orpheus terms accepted first.

---

## 2026-09-20 — Phase 5E: Architecture and security audit

**Prompt:** Full audit of the newly-implemented chatbot (frontend/backend separation, Groq key security, API contracts, error handling, race conditions, accessibility, mobile, typing, tests, docs). Fix only concrete issues found; no unrelated refactoring. Run all existing validation commands.

**Security — confirmed clean:** traced every read of `groq_api_key` end to end (`Settings` → provider factories → `Groq(api_key=...)` constructor); no response schema, error path, or log line ever serializes it. Client-side `ImportMetaEnv` only declares `VITE_API_BASE_URL`/`VITE_DEV_API_PROXY_TARGET` — a stray `VITE_GROQ_API_KEY` would fail to typecheck. Searched all of git history for the `gsk_` key prefix: 2 hits, both documentation placeholders, never a real key. `.env`/`.env.local` confirmed gitignored and never tracked.

**Two real race conditions found and fixed** (empirically confirmed via direct same-tick DOM event dispatch, not just theorized — Playwright's own `.click()` helper serializes actions and couldn't reproduce true simultaneity):

1. `useVoiceRecorder.ts`'s `start()` checked React `status` state for re-entrancy, but `status` only updates *after* `await getUserMedia()` resolves — a fast double-click both reads stale `'idle'` and passes the guard. Confirmed: two `getUserMedia()` calls fire, the second overwrites `streamRef.current`, orphaning the first `MediaStream` (mic left open, tracks never stopped). **Fix:** synchronous `startingRef` lock, set before the `await`.
2. `ChatInput.tsx`'s `submit()` had the same class of bug — its duplicate-submission guard relied on the parent's `disabled` prop, which also only updates one render later. Confirmed: two same-tick Enter presses fired two `/chat/complete` requests, rendered two duplicate user bubbles, and left the first assistant bubble **permanently stuck on the typing indicator** (its request gets silently aborted by the second's abort-on-resend logic). **Fix:** synchronous `submittingRef` lock, cleared via `queueMicrotask` once `disabled` takes over.

Both fixes re-verified empirically after the change: 1 request/1 bubble/0 stuck indicators (was 2/2/1); 1 `getUserMedia()` call (was 2).

**One accessibility gap fixed:** voice recording/transcribing state changes were visible only via placeholder text and icon swap — not announced to screen readers. Added a visually-hidden `role="status" aria-live="polite"` region, mirroring the existing `AvatarStatus` convention exactly.

**Also verified, no changes needed:** shared types have zero drift (regenerated `api.ts` from the live backend, byte-identical to committed version); avatar/3D code completely untouched (empty `git diff` across the whole `avatar/` dir); TTS confirmed absent everywhere; no duplicate `Settings`/router/config systems; `MediaRecorder.stop()` double-invocation tested directly — Chromium handles it safely (no throw, `onstop` fires once), no fix needed; mobile 375px width — no overflow.

**Findings reported but deliberately not fixed** (pre-existing, not introduced by this session's work, or would require touching "preserve existing endpoints" territory):
- Streaming `/chat` route hand-serializes `message_id` (snake_case) but the frontend's `ChatStreamEvent` type expects `messageId` — a latent contract bug from Phase 4B. Currently harmless: `realChatTransport.ts` calls `/chat/complete` exclusively now, so the streaming route is effectively dead code from the frontend's perspective. Worth a decision later: fix the format or deprecate the endpoint.
- Streaming route's inline error events lack `requestId` (unlike the uniform `AppError` envelope) — inherent to `StreamingResponse` not supporting FastAPI's exception-handler machinery.
- Pre-existing ruff (18) / mypy (9) findings, confined to `knowledge_service.py` and the streaming route — unchanged before/after this audit, confirmed via `git stash` baseline comparison.

**Verification:** `npm run typecheck`/`lint`/`build`, `pytest` (29/29), `ruff`, `mypy` — all run before and after the fixes; identical pre-existing baseline, zero regressions.

**Files changed:** `client/src/hooks/useVoiceRecorder.ts`, `client/src/components/chat/ChatInput.tsx`.

---

## 2026-09-20 — Phase 5D: Voice input frontend (mic button, recording, transcription)

**Prompt:** Add a microphone button to the chat input using browser mic APIs, with clear recording state, editable transcription, permission/unsupported-browser/failure handling, duplicate-submission prevention, encapsulated in a reusable hook. No auto-playback yet, no Groq credentials in the browser.

**Files created:**
- `client/src/lib/voice/voiceTransport.ts` — calls `POST /api/v1/voice/transcribe`, mirrors `realChatTransport.ts`'s error-parsing shape (uniform envelope `{code, message, requestId}`); returns a discriminated `{ok: true, text} | {ok: false, error}` result rather than throwing, so callers handle every failure mode explicitly
- `client/src/hooks/useVoiceRecorder.ts` — encapsulates the full `MediaRecorder`/`getUserMedia` lifecycle behind a `status` enum (`idle | recording | transcribing | error`) and a UI-agnostic `onTranscribed(text)` callback; feature-detects `MediaRecorder`/`getUserMedia` once at module scope; distinct user-facing messages per `DOMException.name` (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `SecurityError`); releases the `MediaStream`'s tracks on stop *and* on unmount, so a mid-recording unmount can't leave the mic open

**Files modified:**
- `client/src/components/chat/ChatInput.tsx` — added a mic `IconButton` next to Send; icon swaps `Mic → Square → Loader2` across states with a pulsing red ring while recording (mirrors `TypingIndicator`'s `framer-motion` pulse pattern); transcription only ever fills the existing textarea (never auto-sends) so the visitor can edit before sending; textarea+Send disabled during recording/transcribing so voice and text can't race

Transcription lands in the *same* textarea `ChatInput` already had — no new input surface, no parallel state to keep in sync with the reducer in `useChatSession`.

**Verified live (Playwright, `--use-fake-device-for-media-stream`):** mic button hidden correctly when unsupported; permission-denial message renders; a full record → stop → transcribe → edit → send cycle works end to end against the real backend; 375px mobile width has no overflow and the mic button stays tappable.

---

## 2026-09-20 — Phase 5C: Voice transcription backend (Groq Whisper)

**Prompt:** Add speech-to-text following the existing FastAPI architecture: dedicated service, `POST` endpoint, typed JSON response, server-side-only Groq key, validated/rejected bad audio, tests, shared types updated if needed. No text-to-speech yet.

**Files created:**
- `server/app/schemas/voice.py` — `TranscribeResponse { text: str }`, using the `Schema` camelCase base (matching `health.py`'s convention for a non-streaming JSON response, not `chat.py`'s streaming-route `BaseModel` — that file only uses plain `BaseModel` because its NDJSON events are hand-serialized, never through FastAPI's response-model path)
- `server/app/services/voice_service.py` — `VoiceProvider` ABC + `GroqVoiceProvider`, mirroring `llm_service.py`'s `LLMProvider` pattern exactly (interface, concrete impl, factory); same thread-pool-offload pattern for the synchronous Groq SDK call
- `server/app/api/v1/routes/voice.py` — `POST /api/v1/voice/transcribe`, multipart/form-data with an `audio` field; validates content-type against an allow-list (`audio/webm`, `audio/ogg`, `audio/wav`, `audio/mp4`, etc. — matched against MediaRecorder's actual output, `;codecs=...` stripped before comparison), rejects empty/oversized (>25MB, Groq's documented limit) files, catches `RateLimitError`/`BadRequestError`/`APIError` and maps each to the uniform error envelope
- `server/tests/test_voice.py` — 13 tests: happy path, content-type variants, size/empty rejection, all three Groq error classes, empty-transcription guard, API-key-never-leaked check, sanity check that adding this file didn't disturb the existing chat routes

**Files modified:**
- `server/app/core/config.py` — `groq_whisper_model: str = "whisper-large-v3-turbo"` (reuses the existing `groq_api_key`, no new secret)
- `server/app/core/errors.py` — `InvalidAudioError` (400) and `TranscriptionServiceError` (502), same one-line subclass pattern as `NotFoundError`/`ConflictError`
- `server/app/api/v1/router.py` — registered `voice.router`
- `server/pyproject.toml` — added `python-multipart>=0.0.12` as a real runtime dependency (not dev-only) — FastAPI's `UploadFile`/`File` support requires it, and production traffic needs it too, not just tests
- `server/.env.example`, `docs/environment.md` — documented `GROQ_WHISPER_MODEL`

**Discovery:** the server venv was missing `groq` and `python-multipart` despite being listed in `pyproject.toml` — `pip install -e ".[dev]"` was stale from before those deps were added. Re-synced.

**Verification:** 29/29 tests passing (16 pre-existing + 13 new), ruff/mypy both at the pre-existing baseline (zero new violations — confirmed via `git stash` diff), live ASGI request confirmed `/api/v1/voice/transcribe` correctly registered alongside the existing routes.

---

## 2026-09-19 — Phase 5B: Non-streaming chat completion with conversation history (`/chat/complete`)

**Prompt:** Backend text chat with Groq: accept a user message *and* conversation history, return a single assistant response, validated request/response, safe failure handling, dedicated service following existing conventions, backend tests. Preserve the existing streaming `/chat` endpoint untouched.

**Key decision (confirmed with the user first):** the existing `/chat` streams NDJSON and takes only a single message — no history. Rather than mutate it, added `/chat/complete` as a *new*, separate, non-streaming endpoint. `/chat` stays exactly as it was.

**Files created:**
- `server/tests/test_chat_complete.py` — 16 tests. Caught a real bug in the first draft: `monkeypatch.setattr(llm_service, "get_llm_provider", ...)` patched the wrong module — `chat.py`'s `from ... import get_llm_provider` binds a separate name in the route module's own namespace, so the test silently called the *real* Groq API instead of the mock. Fixed by patching `chat_routes.get_llm_provider` (where it's looked up), not the origin module.

**Files modified:**
- `server/app/schemas/chat.py` — added `ConversationMessage` (`role: "user"|"assistant"`, excludes `"system"` deliberately — the system prompt is always server-injected, never client-suppliable), `ChatCompletionRequest` (`content` + `history`, capped at 40 turns), `ChatCompletionResponse`
- `server/app/services/llm_service.py` — added `complete()` to `LLMProvider`/`GroqProvider`, non-streaming, same thread-pool pattern as `stream_response()`. Needed a `cast(Iterable[ChatCompletionMessageParam], ...)` at the `.create()` call site to satisfy mypy strict (the SDK's overloads want its own typed union, not a plain `list[dict[str, str]]` — the existing `stream_response()` has the identical, still-unresolved mypy gap; scoped the cast to only the new method rather than touching that pre-existing one)
- `server/app/api/v1/routes/chat.py` — added `POST /chat/complete`, guards against an empty Groq completion (would otherwise raise an opaque `ValidationError` from `ConversationMessage`'s `min_length=1`)
- `server/app/core/errors.py` — `RateLimitedError` (429), `LLMServiceError` (502)

**Frontend wiring (confirmed with the user which endpoint to target — chose `/chat/complete` since the requirements never mentioned streaming):**
- `client/src/types/chat-transport.ts` — widened `ChatTransport.send()` to take a `history` param
- `client/src/lib/chat/realChatTransport.ts` — rewritten to call `/chat/complete`, yields the single reply as one `chunk` + `done` event so `useChatSession`'s reducer and every downstream UI component (typing indicator, streaming cursor) work unmodified against a non-streaming transport
- `client/src/lib/chat/mockChatTransport.ts` — signature updated to match (history unused, canned responses)
- `client/src/hooks/useChatSession.ts` — computes history from `state.messages` (capped at 40, filtered to `status === 'complete'`); had to add `state.messages` to `sendMessage`'s `useCallback` deps, since it now reads `state` inside the closure — a real bug caught before shipping, not just a lint nit
- `shared/src/index.ts` — re-exports `./generated/api.js`; discovered `npm run gen:api`'s output had *never* been wired into the package's public surface, so it was unreachable from client code despite existing on disk since Phase 4B

**Verification:** typecheck/lint/build clean; live end-to-end Playwright test against the real backend confirmed genuine multi-turn memory (a follow-up "What about his GitHub?" correctly resolved using turn-1 context); ruff/mypy at pre-existing baseline.

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
