import { useEffect, useRef } from 'react';

import { ErrorBoundary } from '@/app/ErrorBoundary';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { useAvatarState } from '@/hooks/useAvatarState';
import { useChatSession } from '@/hooks/useChatSession';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';

/**
 * Composition root for The Gaffer. Calls `useChatSession()` (chat data,
 * the single source of truth for messages) and layers `useAvatarState()`
 * on top (derived presentation state, not duplicated data) -- this is the
 * one place the two are connected, per the "no duplicated state" rule.
 * Wraps the widget in its own error boundary so a crash here can't take
 * the rest of the portfolio page down with it.
 *
 * `useVoiceOutput` is composed here too, for the same reason: it's a
 * UI-agnostic "speak this text" utility with no knowledge of chat messages,
 * and this is the one place that watches `messages` and decides *when* to
 * call it -- speak the newest assistant reply once it completes, but only
 * while voice output is enabled (off by default; audio never starts
 * unprompted).
 */
export function GafferWidget() {
  const { messages, inputActive, lastMessageStatus, sendMessage, setInputActive } = useChatSession();
  const avatarState = useAvatarState({ messageStatus: lastMessageStatus, inputActive });
  const isBusy = avatarState === 'thinking' || avatarState === 'speaking';

  const voiceOutput = useVoiceOutput();
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!voiceOutput.enabled) return;
    const last = messages.at(-1);
    if (!last || last.role !== 'assistant' || last.status !== 'complete') return;
    if (lastSpokenMessageIdRef.current === last.id) return;

    lastSpokenMessageIdRef.current = last.id;
    voiceOutput.speak(last.content);
    // `voiceOutput` is a fresh object every render, so this also re-runs on
    // every status/errorMessage change (e.g. loading -> playing) -- harmless,
    // since the ref check above makes every extra run a no-op, and it's more
    // robust than hand-picking properties (react-hooks/exhaustive-deps
    // agrees: it flagged the previous partial-dependency version).
  }, [messages, voiceOutput]);

  return (
    <ErrorBoundary>
      <ChatWidget
        messages={messages}
        avatarState={avatarState}
        isBusy={isBusy}
        sendMessage={(text) => void sendMessage(text)}
        setInputActive={setInputActive}
        voiceOutput={voiceOutput}
      />
    </ErrorBoundary>
  );
}
