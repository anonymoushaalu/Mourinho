import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { AvatarButton } from '@/components/avatar/AvatarButton';
import { ChatPanel } from '@/components/chat/ChatPanel';
import type { AvatarState, ChatMessage } from '@/types';

/**
 * Everything a chat-surface component needs to render -- chat data from
 * `useChatSession` plus avatar presentation state from `useAvatarState`,
 * merged once in `GafferWidget`. Kept as one prop shape (rather than
 * passing `useChatSession`'s return type directly, as before Phase 2) since
 * avatar state no longer comes from the same hook that owns chat data.
 */
export interface GafferSessionProps {
  messages: ChatMessage[];
  avatarState: AvatarState;
  isBusy: boolean;
  sendMessage: (text: string) => void;
  setInputActive: (active: boolean) => void;
}

/**
 * Floating container: owns open/closed state, positions the avatar
 * button and the panel across breakpoints. Mobile opens full-screen;
 * desktop docks a fixed-size card bottom-right.
 */
export function ChatWidget(props: GafferSessionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none sm:inset-auto sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-auto fixed inset-0 sm:absolute sm:inset-auto sm:bottom-[4.5rem] sm:right-0 sm:h-[560px] sm:w-[380px]"
          >
            <ChatPanel {...props} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <AvatarButton
          state={props.avatarState}
          onClick={() => setOpen(true)}
          className="pointer-events-auto absolute bottom-6 right-6 sm:static"
        />
      )}
    </div>
  );
}
