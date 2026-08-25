import { AvatarRenderer } from '@/components/avatar/AvatarRenderer';
import { AVATAR_STATE_LABEL } from '@/lib/avatarStatus';
import { cn } from '@/lib/cn';
import type { AvatarState } from '@/types';

interface AvatarButtonProps {
  state: AvatarState;
  onClick: () => void;
  className?: string;
}

/**
 * The avatar itself, as a real button -- opens the chat. One focusable,
 * semantic control instead of pairing a decorative avatar image next to a
 * separate icon button, which is what this replaces. Native <button>
 * semantics mean keyboard focus and Enter/Space activation come for free.
 */
export function AvatarButton({ state, onClick, className }: AvatarButtonProps) {
  const label =
    state === 'idle' ? 'Open chat with The Gaffer' : `Open chat with The Gaffer — ${AVATAR_STATE_LABEL[state]}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
        className,
      )}
    >
      <AvatarRenderer state={state} className="h-full w-full" />
    </button>
  );
}
