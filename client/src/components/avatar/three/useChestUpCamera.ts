import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { Object3D } from 'three';

// Vertical field of view, in degrees. ~68mm-equivalent: wide enough to stay
// legible at 40-64px, long enough to avoid nose-forward wide-angle distortion.
const FOV_DEG = 20;

// Margins as fractions of the head-top-to-chest span, not absolute meters --
// this keeps framing scale-invariant if the model is ever re-exported at a
// different height (there's already a chest-up work-in-progress .blend at
// the repo root, so another export is plausible).
const HEADROOM_FRACTION = 0.09;
const CHEST_CROP_FRACTION = 0.12;

// Named bones measured at runtime rather than hardcoding estimated world
// positions -- robust to a re-export, and removes "did I sum the bone chain
// right" as a class of bug entirely. See useChestUpCamera below for why this
// must run after the base pose (not the T-pose rest) is applied.
const HEAD_TOP_BONE = 'HeadTop_End';
const CHEST_BONE = 'Spine1';
const HEAD_BONE = 'Head';

/**
 * Frames a chest-up perspective shot of the avatar by measuring real bone
 * world positions once, after the model's base pose is applied -- not from
 * hardcoded constants, and not from `Box3.setFromObject(scene)` (which would
 * measure the full standing figure, or the T-pose if called too early).
 *
 * Runs once via `useLayoutEffect`, not per-frame: the rig is only re-posed by
 * the animation mixer, and that motion measures well under a pixel at this
 * render size -- continuous re-targeting would cost more than it's worth.
 *
 * Must be called AFTER the caller has applied the initial animation pose
 * (`ready` should only flip true once that's done), or this will measure the
 * bind-pose T-pose instead of the intended chest-up subject.
 */
export function useChestUpCamera(scene: Object3D | null, ready: boolean): void {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    if (!ready || !scene) return;
    if (!(camera instanceof PerspectiveCamera)) return;

    scene.updateMatrixWorld(true);

    const headTopBone = scene.getObjectByName(HEAD_TOP_BONE);
    const chestBone = scene.getObjectByName(CHEST_BONE);
    const headBone = scene.getObjectByName(HEAD_BONE);
    // Bad/unexpected GLB swap: leave the camera at its declarative default
    // (wrong framing, but visible) rather than crash the avatar.
    if (!headTopBone || !chestBone || !headBone) return;

    const headTop = headTopBone.getWorldPosition(new Vector3());
    const chest = chestBone.getWorldPosition(new Vector3());
    const head = headBone.getWorldPosition(new Vector3());

    const span = headTop.y - chest.y;
    if (span <= 0) return;

    const top = headTop.y + HEADROOM_FRACTION * span;
    const bottom = chest.y + CHEST_CROP_FRACTION * span;
    const frameHeight = top - bottom;
    const targetY = (top + bottom) / 2;

    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
    const dist = frameHeight / (2 * Math.tan(MathUtils.degToRad(FOV_DEG) / 2)) / Math.min(1, aspect);

    camera.fov = FOV_DEG;
    camera.near = Math.max(0.05, dist - 0.6);
    camera.far = dist + 1.2;
    // Character faces +Z (verified against the GLB's own geometry) --
    // camera sits in front of the face at positive Z, looking back toward it.
    camera.position.set(head.x, targetY, head.z + dist);
    camera.lookAt(head.x, targetY, head.z);
    camera.updateProjectionMatrix();
  }, [scene, ready, camera, size]);
}
