import type { AvatarState } from '@/types';

/**
 * Single source of truth for avatar-state copy and color, shared by
 * `AvatarStatus` (visible label) and `AvatarButton` (aria-label) so the two
 * never drift out of sync with each other.
 */
export const AVATAR_STATE_LABEL: Record<AvatarState, string> = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  success: 'Response ready',
  error: 'Something went wrong',
};

export const AVATAR_STATE_DOT_COLOR: Record<AvatarState, string> = {
  idle: 'bg-slate-300 dark:bg-slate-600',
  listening: 'bg-sky-400',
  thinking: 'bg-indigo-400',
  speaking: 'bg-indigo-500',
  success: 'bg-emerald-500',
  error: 'bg-red-500',
};
