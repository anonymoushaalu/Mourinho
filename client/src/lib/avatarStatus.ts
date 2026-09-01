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

/**
 * Shared between `AvatarPlaceholder` (CSS halo) and `ThreeAvatarRenderer`
 * (DOM halo behind the canvas, plus the 3D rim light's color/intensity) so
 * the two renderers can never drift apart on what each state looks like.
 */
export const AVATAR_STATE_GLOW_GRADIENT: Record<AvatarState, string> = {
  idle: 'from-sky-400 via-indigo-500 to-violet-600',
  listening: 'from-sky-400 via-indigo-500 to-violet-600',
  thinking: 'from-sky-400 via-indigo-500 to-violet-600',
  speaking: 'from-sky-400 via-indigo-500 to-violet-600',
  success: 'from-emerald-400 via-emerald-500 to-teal-500',
  error: 'from-rose-400 via-red-500 to-rose-600',
};

export const AVATAR_STATE_GLOW_OPACITY: Record<AvatarState, number> = {
  idle: 0.3,
  listening: 0.5,
  thinking: 0.55,
  speaking: 0.8,
  success: 0.7,
  error: 0.6,
};

/** Hex equivalents of the glow gradient's dominant color, for the 3D rim light. */
export const AVATAR_STATE_ACCENT_HEX: Record<AvatarState, string> = {
  idle: '#6366f1',
  listening: '#38bdf8',
  thinking: '#818cf8',
  speaking: '#6366f1',
  success: '#10b981',
  error: '#ef4444',
};

/** Rim-light intensity per state, mirroring the glow-opacity ramp above. */
export const AVATAR_STATE_RIM_INTENSITY: Record<AvatarState, number> = {
  idle: 3.5,
  listening: 5,
  thinking: 5.5,
  speaking: 9,
  success: 7.5,
  error: 6.5,
};
