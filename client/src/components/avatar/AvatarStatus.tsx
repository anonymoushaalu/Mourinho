import { AVATAR_STATE_DOT_COLOR, AVATAR_STATE_LABEL } from '@/lib/avatarStatus';
import { cn } from '@/lib/cn';
import type { AvatarState } from '@/types';

interface AvatarStatusProps {
  state: AvatarState;
  className?: string;
}

/**
 * Small live status line: real visible text plus a decorative dot, not
 * color alone -- a colorblind or low-vision user gets the same information
 * a sighted user with full color perception does. `aria-live` announces
 * changes to screen readers without needing focus to move.
 */
export function AvatarStatus({ state, className }: AvatarStatusProps) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)} role="status" aria-live="polite">
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300',
          AVATAR_STATE_DOT_COLOR[state],
        )}
      />
      <span className="truncate text-xs text-slate-500 dark:text-slate-400">{AVATAR_STATE_LABEL[state]}</span>
    </span>
  );
}
