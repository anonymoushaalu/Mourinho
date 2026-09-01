import { LoopOnce, LoopRepeat } from 'three';

import type { AvatarState } from '@/types';

/**
 * Served from `client/public/models/`, copied from the Blender-exported
 * `MOU.glb` at the repo root (original left in place as the Blender source).
 * `BASE_URL`-relative so this survives a future Vite `base` change.
 */
export const AVATAR_MODEL_URL = `${import.meta.env.BASE_URL}models/gaffer-avatar.glb`;

export interface ClipBinding {
  /** Animation clip name as authored in the GLB. */
  readonly clip: string;
  readonly loop: typeof LoopRepeat | typeof LoopOnce;
  /** Crossfade-in duration in seconds, for state transitions after the first. */
  readonly fadeIn: number;
  /**
   * Fraction (0..1) of the clip's duration to freeze on under
   * prefers-reduced-motion. All ten body clips share a byte-identical
   * frame-0 pose (the shared "base pose" the rig snaps to the moment any
   * clip plays) -- freezing every state at 0 would make all six states
   * look visually identical. Freeze mid-clip instead, where each clip's
   * characteristic pose actually differs. `idle` is the one exception: it
   * IS the neutral reference pose, so 0 is correct for it specifically.
   */
  readonly freezeAt: number;
}

/**
 * State -> animation clip. The GLB ships 12 clips; only the 10 that animate
 * bone transforms are used here (`Avatar_Blink`/`Avatar_Blink_Lashes` drive
 * morph/blendshape weights -- that's facial animation, out of scope for this
 * phase). Playing these clips as authored isn't "facial animation" and isn't
 * "modifying the GLB" -- it's using the rig exactly as exported.
 */
export const AVATAR_STATE_CLIP: Record<AvatarState, ClipBinding> = {
  idle: { clip: 'Avatar_Idle', loop: LoopRepeat, fadeIn: 0.35, freezeAt: 0 },
  listening: { clip: 'Avatar_Listening', loop: LoopRepeat, fadeIn: 0.35, freezeAt: 0.5 },
  thinking: { clip: 'Avatar_Thinking', loop: LoopRepeat, fadeIn: 0.35, freezeAt: 0.5 },
  // Not Avatar_Explaining: that clip animates the forearm/hand, which sit
  // below the chest-up frame and would be invisible. TalkingGesture animates
  // head + shoulder, both in frame.
  speaking: { clip: 'Avatar_TalkingGesture', loop: LoopRepeat, fadeIn: 0.3, freezeAt: 0.5 },
  success: { clip: 'Avatar_Success', loop: LoopOnce, fadeIn: 0.2, freezeAt: 0.55 },
  // No literal "error" clip exists. Avatar_Waiting's slower, subdued drift
  // reads as distinguishable from idle in silhouette; the actual "something's
  // wrong" signal comes from the red rim light/halo tint (AVATAR_STATE_ACCENT_HEX),
  // matching how AvatarPlaceholder already handles error -- same shape, red gradient.
  error: { clip: 'Avatar_Waiting', loop: LoopRepeat, fadeIn: 0.2, freezeAt: 0.55 },
};

/**
 * Reserved for a future phase: Avatar_Navigate_Left/Right (no `navigating`
 * member on AvatarState yet), Avatar_Saccade (eye-only, invisible at this
 * size), and the two blink clips (morph-target facial animation).
 */
