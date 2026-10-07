import { AvatarPlaceholder } from '@/components/avatar/AvatarPlaceholder';
import { cn } from '@/lib/cn';
import type { AvatarRendererProps } from '@/types';

/**
 * The avatar rendering boundary. Every consumer in the chat app
 * (`AvatarButton`, `ChatPanel`'s header) talks to `AvatarRenderer` and only
 * `AvatarRenderer` -- none of them know or care how the avatar is actually
 * drawn.
 *
 * For the current production milestone, `AvatarPlaceholder` (CSS/Framer
 * Motion) is the primary avatar, not a loading fallback for something else.
 * The 3D React Three Fiber renderer (`components/avatar/three/`, including
 * the Blender-exported GLB) is untouched on disk and was previously wired
 * in here behind `lazy()` + `Suspense` + an error boundary -- deliberately
 * not reconnected this milestone, per scope ("do not connect Blender, do
 * not modify the GLB"). Restoring it later is swapping this component's
 * body back to that wrapper; everything the 3D path needs still exists.
 *
 * `isActive` is derived once here (`state !== 'idle'`) so `AvatarPlaceholder`
 * doesn't reimplement that check itself, and so a future 3D re-swap doesn't
 * need every call site updated.
 */
export function AvatarRenderer({ state, className }: AvatarRendererProps) {
  const isActive = state !== 'idle';
  return <AvatarPlaceholder state={state} isActive={isActive} className={cn(className)} />;
}
