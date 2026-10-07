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
 * unprompted). Its `status === 'playing'` also feeds `useAvatarState` as
 * `isSpeaking`, so the avatar visibly speaks for the actual audio duration,
 * not just the brief moment a reply finishes arriving.
 */
export function GafferWidget() {
  const { messages, inputActive, lastMessageStatus, sendMessage, setInputActive } = useChatSession();
  const voiceOutput = useVoiceOutput();
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  const avatarState = useAvatarState({
    messageStatus: lastMessageStatus,
    inputActive,
    isSpeaking: voiceOutput.status === 'playing',
  });
  // Deliberately NOT derived from avatarState (which now also reads
  // 'speaking' for the full TTS playback duration -- seconds, not the
  // near-instant network-bound flash this used to be): a visitor should be
  // able to type a follow-up while The Gaffer is still talking, not get
  // locked out of the input for as long as the reply takes to read aloud.
  const isBusy = lastMessageStatus === 'pending' || lastMessageStatus === 'streaming';

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
