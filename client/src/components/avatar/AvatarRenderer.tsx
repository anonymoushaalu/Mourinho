import { AvatarPlaceholder } from '@/components/avatar/AvatarPlaceholder';
import { cn } from '@/lib/cn';
import type { AvatarRendererProps } from '@/types';

/**
 * The avatar rendering boundary. Every consumer in the chat app
 * (`AvatarButton`, `ChatPanel`'s header) talks to `AvatarRenderer` and only
 * `AvatarRenderer` -- none of them know or care how the avatar is actually
 * drawn, and none of them import Three.js or anything GLB-related.
 *
 * Today this renders `AvatarPlaceholder` (CSS/Framer Motion). The planned
 * swap, when the Blender-exported chest-up model.glb is ready:
 *
 *   AvatarRenderer
 *         |  (only this file's internals change for the swap)
 *         v
 *   ThreeAvatarRenderer
 *         v
 *   React Three Fiber <Canvas> + model.glb
 *
 * `ThreeAvatarRenderer` will receive the same `{ state, isActive, className }`
 * shape `AvatarPlaceholder` receives today -- see `AvatarImplementationProps`
 * in `types/avatar.ts`. `isActive` is derived once here (`state !== 'idle'`)
 * so every concrete renderer doesn't reimplement that check itself.
 *
 * No file outside `components/avatar` should ever need to import Three.js,
 * @react-three/fiber, or a GLB loader -- that all stays encapsulated behind
 * this component when it's built.
 */
export function AvatarRenderer({ state, className }: AvatarRendererProps) {
  const isActive = state !== 'idle';
  return <AvatarPlaceholder state={state} isActive={isActive} className={cn(className)} />;
}
