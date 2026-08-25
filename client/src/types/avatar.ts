export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error';

/**
 * External prop surface for `AvatarRenderer` — stable across the
 * placeholder/Three.js swap. Everything in the chat app (AvatarButton,
 * ChatPanel's header) talks to this shape and nothing richer.
 */
export interface AvatarRendererProps {
  state: AvatarState;
  className?: string;
}

/**
 * What `AvatarRenderer` passes to whichever concrete implementation it
 * delegates to (`AvatarPlaceholder` today, `ThreeAvatarRenderer` later).
 * `isActive` is derived once in `AvatarRenderer` (state !== 'idle') so
 * every concrete renderer doesn't reimplement that check itself. See
 * `components/avatar/AvatarRenderer.tsx` for the full swap plan.
 */
export interface AvatarImplementationProps {
  state: AvatarState;
  isActive: boolean;
  className?: string;
}
