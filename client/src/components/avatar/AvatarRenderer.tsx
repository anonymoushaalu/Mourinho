import { Suspense, lazy } from 'react';

import { AvatarErrorBoundary } from '@/components/avatar/AvatarErrorBoundary';
import { AvatarPlaceholder } from '@/components/avatar/AvatarPlaceholder';
import { cn } from '@/lib/cn';
import type { AvatarRendererProps } from '@/types';

// Lazy: three + @react-three/fiber + @react-three/drei is ~200kB gzipped.
// Keeping it out of the main chunk means the chat UI paints from
// AvatarPlaceholder immediately, then upgrades to 3D once the chunk and GLB
// arrive -- with no visible loading state, since the fallback below IS what
// ships today. `.then()` re-maps to a named export to match this codebase's
// convention of no default exports.
const ThreeAvatarRenderer = lazy(() =>
  import('@/components/avatar/three/ThreeAvatarRenderer').then((m) => ({ default: m.ThreeAvatarRenderer })),
);

/**
 * The avatar rendering boundary. Every consumer in the chat app
 * (`AvatarButton`, `ChatPanel`'s header) talks to `AvatarRenderer` and only
 * `AvatarRenderer` -- none of them know or care how the avatar is actually
 * drawn, and none of them import Three.js or anything GLB-related.
 *
 * Renders `ThreeAvatarRenderer` (React Three Fiber + the Blender-exported
 * chest-up model.glb), with `AvatarPlaceholder` (CSS/Framer Motion) as both
 * the Suspense fallback (while the chunk/GLB load) and the error-boundary
 * fallback (if the 3D path fails for any reason -- missing/corrupt GLB,
 * WebGL unavailable, etc.). Building the fallback element once and handing
 * the same instance to both guarantees the loading and error states are
 * pixel-identical to each other and to what shipped before this swap.
 *
 * `isActive` is derived once here (`state !== 'idle'`) so every concrete
 * renderer doesn't reimplement that check itself.
 *
 * No file outside `components/avatar` should ever need to import Three.js,
 * @react-three/fiber, or a GLB loader -- that all stays encapsulated behind
 * this component and `components/avatar/three/`.
 */
export function AvatarRenderer({ state, className }: AvatarRendererProps) {
  const isActive = state !== 'idle';
  const fallback = <AvatarPlaceholder state={state} isActive={isActive} className={cn(className)} />;

  return (
    <AvatarErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <ThreeAvatarRenderer state={state} isActive={isActive} className={cn(className)} />
      </Suspense>
    </AvatarErrorBoundary>
  );
}
