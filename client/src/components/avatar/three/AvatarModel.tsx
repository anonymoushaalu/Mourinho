import { useAnimations, useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LoopOnce } from 'three';
import type { AnimationAction, Group } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { useChestUpCamera } from '@/components/avatar/three/useChestUpCamera';
import { AVATAR_MODEL_URL, AVATAR_STATE_CLIP } from '@/components/avatar/three/avatarClips';
import type { AvatarState } from '@/types';

// Deliberately no module-scope `useGLTF.preload(...)` here: drei's preload
// returns `undefined`, so a failed preload has no promise for us to attach a
// .catch() to -- if it rejects before any component has mounted to receive
// it via Suspense, that's an unhandled rejection with no functional benefit
// (the fallback UI shows instantly either way). `useGLTF()` inside the
// component below is Suspense-aware and is the real, correctly-handled load
// path for both the success and failure cases.

interface AvatarModelProps {
  state: AvatarState;
  prefersReducedMotion: boolean;
}

/**
 * Loads the GLB (via drei's process-wide cache), clones it per-mount, and
 * owns the state -> animation-clip crossfade machine. Rendered only once the
 * GLB has resolved -- `AvatarRenderer`'s Suspense boundary handles the wait.
 */
export function AvatarModel({ state, prefersReducedMotion }: AvatarModelProps) {
  const gltf = useGLTF(AVATAR_MODEL_URL);

  // SkeletonUtils.clone, not Object3D.clone(): all 8 meshes are SkinnedMesh
  // sharing one skeleton. A plain clone copies the meshes but leaves
  // skeleton.bones pointing at the ORIGINAL skeleton, so this clone's mixer
  // would animate a skeleton nothing here renders. Cloning gives each mount
  // (the button/header avatars are mutually exclusive, but each open/close
  // cycle is a fresh mount) its own bone hierarchy while sharing the
  // never-disposed cached geometries/materials/textures.
  const scene = useMemo(() => cloneSkeleton(gltf.scene) as Group, [gltf.scene]);
  const { actions, mixer } = useAnimations(gltf.animations, scene);

  const previousActionRef = useRef<AnimationAction | null>(null);
  // Flips true once the first pose has been applied -- gates the camera hook
  // below so it measures the posed bones, never the T-pose-ish bind pose.
  const [posed, setPosed] = useState(false);

  useLayoutEffect(() => {
    const binding = AVATAR_STATE_CLIP[state];
    const next = actions[binding.clip];
    if (!next) return; // defensive: clip name not found in this GLB

    next.reset();
    next.setLoop(binding.loop, binding.loop === LoopOnce ? 1 : Infinity);
    next.clampWhenFinished = binding.loop === LoopOnce;

    const previous = previousActionRef.current;
    const isFirstActivation = previous === null;

    if (prefersReducedMotion) {
      // Instant pose swap, not a cross-fade -- a cross-fade is itself motion.
      mixer.stopAllAction();
      next.play();
      mixer.setTime(binding.freezeAt * next.getClip().duration);
    } else if (isFirstActivation || previous === next) {
      // Full weight, no fade-in. All ten body clips share a byte-identical
      // frame-0 pose that differs sharply from the model's true (T-pose-ish)
      // rest pose -- fading in here would visibly swing the arms down from
      // horizontal across the whole frame on first paint. mixer.update(0)
      // applies the pose synchronously, before this layout effect returns
      // and the browser gets a chance to paint.
      next.play();
      mixer.update(0);
    } else {
      previous.fadeOut(binding.fadeIn);
      next.fadeIn(binding.fadeIn).play();
    }

    previousActionRef.current = next;
    setPosed(true); // no-op re-render once already true; Object.is bails out
  }, [actions, mixer, state, prefersReducedMotion]);

  useChestUpCamera(scene, posed);

  return <primitive object={scene} />;
}
