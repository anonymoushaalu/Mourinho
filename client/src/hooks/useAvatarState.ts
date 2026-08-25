import { useEffect, useRef, useState } from 'react';

import type { AvatarState, MessageStatus } from '@/types';

const SUCCESS_FLASH_MS = 1400;
const ERROR_FLASH_MS = 2200;

interface UseAvatarStateParams {
  /** Status of the most recent assistant message, or null before the first send / while the last message is the user's. */
  messageStatus: MessageStatus | null;
  /** Whether the chat input currently has focus. */
  inputActive: boolean;
}

/**
 * Derives the avatar's presentation state from chat state. Does not own
 * chat data itself -- `useChatSession` remains the single source of truth
 * for messages; this hook only transforms that data into a richer,
 * timing-aware view for the avatar.
 *
 * The one thing chat state can't express on its own: brief, timed
 * "success"/"error" flashes after a message resolves, before falling back
 * to idle/listening. That's local state + a timer, kept here rather than in
 * the reducer so `useChatSession` doesn't have to know the avatar exists.
 */
export function useAvatarState({ messageStatus, inputActive }: UseAvatarStateParams): AvatarState {
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const prevStatusRef = useRef<MessageStatus | null>(null);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = messageStatus;

    if (messageStatus === 'complete' && prevStatus !== 'complete') {
      setFlash('success');
      const timer = setTimeout(() => setFlash(null), SUCCESS_FLASH_MS);
      return () => clearTimeout(timer);
    }
    if (messageStatus === 'error' && prevStatus !== 'error') {
      setFlash('error');
      const timer = setTimeout(() => setFlash(null), ERROR_FLASH_MS);
      return () => clearTimeout(timer);
    }
    if (messageStatus === 'pending' || messageStatus === 'streaming') {
      // A new message started before the previous flash finished -- don't let a stale flash linger.
      setFlash(null);
    }
    return undefined;
  }, [messageStatus]);

  if (flash) return flash;
  if (messageStatus === 'pending') return 'thinking';
  if (messageStatus === 'streaming') return 'speaking';
  return inputActive ? 'listening' : 'idle';
}
