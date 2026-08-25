# The Gaffer — Development Log

Running log of changes made in this repo, updated after every prompt. Newest entry on top. Each entry covers what was asked, what changed on disk, and anything worth remembering later.

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
