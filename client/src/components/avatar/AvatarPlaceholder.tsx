import { AnimatePresence, motion } from 'framer-motion';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AVATAR_STATE_GLOW_GRADIENT as GLOW_GRADIENT, AVATAR_STATE_GLOW_OPACITY as GLOW_OPACITY, AVATAR_STATE_LABEL } from '@/lib/avatarStatus';
import { cn } from '@/lib/cn';
import type { AvatarImplementationProps, AvatarState } from '@/types';

const ORB_ANIMATION: Record<AvatarState, { scale: number[]; duration: number; repeat: boolean }> = {
  idle: { scale: [1, 1.02, 1], duration: 3.4, repeat: true },
  listening: { scale: [1, 1.05, 1], duration: 1.5, repeat: true },
  thinking: { scale: [1, 1.03, 1], duration: 1.1, repeat: true },
  speaking: { scale: [1, 1.08, 1], duration: 0.5, repeat: true },
  success: { scale: [1, 1.12, 1], duration: 0.5, repeat: false },
  error: { scale: [1, 0.96, 1], duration: 0.4, repeat: false },
};

/**
 * Gradient-orb stand-in for the real GLB avatar. Kept deliberately simple --
 * a calm, premium "digital assistant" mark rather than a cartoon mascot --
 * so it reads as intentional, not unfinished, while it's the only avatar
 * that exists. Receives `AvatarImplementationProps` (see `AvatarRenderer`);
 * `isActive` isn't consumed yet -- CSS state alone is enough here -- but the
 * field exists now because the future Three.js renderer will need it.
 */
export function AvatarPlaceholder({ state, className }: AvatarImplementationProps) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const orb = ORB_ANIMATION[state];

  return (
    <div
      className={cn('relative aspect-square', className)}
      role="img"
      aria-label={`The Gaffer avatar — ${AVATAR_STATE_LABEL[state]}`}
    >
      <motion.div
        className={cn('absolute inset-0 rounded-full bg-gradient-to-br blur-2xl', GLOW_GRADIENT[state])}
        animate={{ opacity: GLOW_OPACITY[state] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {!prefersReducedMotion && (
        <AnimatePresence>
          {state === 'thinking' && (
            <motion.div
              key="thinking-ring"
              className="absolute inset-[-6%] rounded-full border-2 border-dashed border-indigo-300/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.3 },
                rotate: { duration: 6, repeat: Infinity, ease: 'linear' },
              }}
            />
          )}
          {state === 'speaking' &&
            [0, 1].map((i) => (
              <motion.div
                key={`speaking-ring-${i}`}
                className="absolute inset-0 rounded-full border border-sky-300/70"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
              />
            ))}
        </AnimatePresence>
      )}

      {/* Reduced-motion equivalent: a static ring communicates the same state without motion. */}
      {prefersReducedMotion && (state === 'thinking' || state === 'speaking') && (
        <div
          className={cn(
            'absolute inset-[-6%] rounded-full border-2',
            state === 'thinking' ? 'border-dashed border-indigo-300/60' : 'border-sky-300/70',
          )}
        />
      )}

      <motion.div
        className="absolute inset-[8%] rounded-full bg-gradient-to-br from-slate-50 to-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.25)] dark:from-slate-700 dark:to-slate-900"
        {...(prefersReducedMotion ? {} : { animate: { scale: orb.scale } })}
        transition={{ duration: orb.duration, repeat: orb.repeat ? Infinity : 0, ease: 'easeInOut' }}
      >
        <div className={cn('absolute inset-[22%] rounded-full bg-gradient-to-br opacity-90', GLOW_GRADIENT[state])} />
      </motion.div>
    </div>
  );
}
