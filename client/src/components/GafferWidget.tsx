import { ErrorBoundary } from '@/app/ErrorBoundary';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { useAvatarState } from '@/hooks/useAvatarState';
import { useChatSession } from '@/hooks/useChatSession';

/**
 * Composition root for The Gaffer. Calls `useChatSession()` (chat data,
 * the single source of truth for messages) and layers `useAvatarState()`
 * on top (derived presentation state, not duplicated data) -- this is the
 * one place the two are connected, per the "no duplicated state" rule.
 * Wraps the widget in its own error boundary so a crash here can't take
 * the rest of the portfolio page down with it.
 */
export function GafferWidget() {
  const { messages, inputActive, lastMessageStatus, sendMessage, setInputActive } = useChatSession();
  const avatarState = useAvatarState({ messageStatus: lastMessageStatus, inputActive });
  const isBusy = avatarState === 'thinking' || avatarState === 'speaking';

  return (
    <ErrorBoundary>
      <ChatWidget
        messages={messages}
        avatarState={avatarState}
        isBusy={isBusy}
        sendMessage={(text) => void sendMessage(text)}
        setInputActive={setInputActive}
      />
    </ErrorBoundary>
  );
}
