import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

import { AvatarPlaceholder } from '@/components/avatar/AvatarPlaceholder';
import { AvatarModel } from '@/components/avatar/three/AvatarModel';
import { StudioEnvironment } from '@/components/avatar/three/StudioEnvironment';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  AVATAR_STATE_ACCENT_HEX,
  AVATAR_STATE_GLOW_GRADIENT,
  AVATAR_STATE_GLOW_OPACITY,
  AVATAR_STATE_LABEL,
  AVATAR_STATE_RIM_INTENSITY,
} from '@/lib/avatarStatus';
import { cn } from '@/lib/cn';
import type { AvatarImplementationProps } from '@/types';

/**
 * WebGL context loss doesn't throw, so `AvatarErrorBoundary` (a React error
 * boundary) can't catch it -- the canvas would just go blank. Must live
 * inside `<Canvas>` (useThree only works in the R3F reconciler tree) and
 * report up to the DOM-level parent, which swaps to the placeholder.
 */
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    function handleContextLost(event: Event) {
      event.preventDefault();
      onLost();
    }
    canvas.addEventListener('webglcontextlost', handleContextLost);
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost);
  }, [gl, onLost]);

  return null;
}

/**
 * The real 3D avatar. `AvatarRenderer` lazy-loads this behind a Suspense
 * boundary (chunk + GLB load) and an error boundary (render/parse failure) --
 * both fall back to `AvatarPlaceholder`, so this component only needs to
 * handle the one failure mode neither of those catches: context loss after a
 * successful mount.
 */
export function ThreeAvatarRenderer({ state, isActive, className }: AvatarImplementationProps) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [contextLost, setContextLost] = useState(false);

  if (contextLost) {
    return <AvatarPlaceholder state={state} isActive={isActive} {...(className ? { className } : {})} />;
  }

  return (
    <div
      className={cn('relative aspect-square', className)}
      role="img"
      aria-label={`The Gaffer avatar — ${AVATAR_STATE_LABEL[state]}`}
    >
      {/* Halo: identical gradient/opacity language to AvatarPlaceholder, so
          the two renderers read as one continuous product. Given the baked
          animation's on-screen motion is sub-pixel at this size, this halo
          (plus the rim light below) carries most of the per-state signal. */}
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-500',
          AVATAR_STATE_GLOW_GRADIENT[state],
        )}
        style={{ opacity: AVATAR_STATE_GLOW_OPACITY[state] }}
      />

      {/* Circular medallion: canvas is square, masked to match the round
          silhouette AvatarButton/ChatPanel already use. The backdrop gradient
          keeps dark hair legible against both light and dark panel backgrounds. */}
      <div className="absolute inset-[8%] overflow-hidden rounded-full bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-900">
        <Canvas
          dpr={[1, 2]}
          frameloop={prefersReducedMotion ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 20, near: 1.0, far: 3.0, position: [0, 1.55, 1.55] }}
        >
          <ContextLossWatcher onLost={() => setContextLost(true)} />
          <StudioEnvironment />

          <hemisphereLight args={['#e8eef7', '#1e293b', 0.6]} />
          {/* Key: ~30deg elevation, screen-right, warm. 30deg avoids the
              raccoon-eye shadows a steeper key would cast at this head size. */}
          <directionalLight position={[2.0, 2.0, 2.85]} intensity={2.4} color="#fff4e8" />
          {/* Fill: lower elevation, screen-left, cool -- ~1:3 ratio to key. */}
          <directionalLight position={[-2.95, 1.05, 2.5]} intensity={0.85} color="#cfe0f5" />
          {/* Rim: the actual per-state signal, since baked motion is sub-pixel here. */}
          <pointLight
            position={[-0.55, 2.07, -0.87]}
            color={AVATAR_STATE_ACCENT_HEX[state]}
            intensity={AVATAR_STATE_RIM_INTENSITY[state]}
            distance={3}
            decay={2}
          />

          <AvatarModel state={state} prefersReducedMotion={prefersReducedMotion} />
        </Canvas>
      </div>
    </div>
  );
}
