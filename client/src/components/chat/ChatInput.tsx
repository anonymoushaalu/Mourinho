import { useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mic, Send, Square } from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/cn';

interface ChatInputProps {
  onSend: (text: string) => void;
  onActiveChange: (active: boolean) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, onActiveChange, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  // `disabled` (from the parent, via useAvatarState) only reflects a sent
  // message one render later -- two Enter/click events dispatched in the
  // same tick (key-repeat, a stuck key, a double-tap) both read the same
  // stale `inputDisabled`/`value` and both pass the guard below, firing two
  // requests for one message and leaving a permanently stuck "thinking"
  // bubble for the first (its request gets silently aborted by the
  // second). Confirmed via direct testing. This ref is set synchronously,
  // so the second call in the same tick is rejected regardless of when the
  // parent re-renders.
  const submittingRef = useRef(false);

  // Transcription only fills the textarea -- it never sends on its own, so
  // the visitor always gets to read/edit what was heard before it goes out.
  const {
    status: voiceStatus,
    isSupported: voiceSupported,
    errorMessage: voiceError,
    start,
    stop,
  } = useVoiceRecorder({ onTranscribed: (text) => setValue(text) });

  const isRecording = voiceStatus === 'recording';
  const isTranscribing = voiceStatus === 'transcribing';
  // Recording/transcribing and sending are mutually exclusive -- one active
  // voice/text operation at a time, so a stray keystroke or click can't fire
  // a duplicate submission alongside it.
  const inputDisabled = disabled || isRecording || isTranscribing;

  function submit() {
    if (inputDisabled || submittingRef.current || value.trim().length === 0) return;
    submittingRef.current = true;
    onSend(value);
    setValue('');
    // `disabled` takes over as the guard for the request's actual duration;
    // this only needs to cover the gap until that prop updates.
    queueMicrotask(() => {
      submittingRef.current = false;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleMicClick() {
    if (isRecording) {
      stop();
    } else {
      void start();
    }
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      {/* Visible via the textarea's placeholder text already, but placeholder
          changes aren't reliably announced to screen readers -- this mirrors
          AvatarStatus's role="status"/aria-live="polite" convention so voice
          state changes are actually heard, not just seen. */}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {isRecording ? 'Recording' : isTranscribing ? 'Transcribing your recording' : ''}
        </span>
      </VisuallyHidden>
      {voiceError && (
        <p className="px-3 pt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {voiceError}
        </p>
      )}
      <div className="flex items-end gap-2 p-3">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => onActiveChange(true)}
          onBlur={() => onActiveChange(false)}
          onKeyDown={handleKeyDown}
          disabled={inputDisabled}
          rows={1}
          placeholder={
            isRecording
              ? 'Listening...'
              : isTranscribing
                ? 'Transcribing...'
                : 'Ask The Gaffer anything...'
          }
          className="max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        {voiceSupported && (
          <div className="relative mb-0.5">
            {isRecording && (
              <motion.span
                className="absolute inset-0 rounded-full bg-red-500"
                animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.4, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              />
            )}
            <IconButton
              icon={isTranscribing ? Loader2 : isRecording ? Square : Mic}
              aria-label={isRecording ? 'Stop recording' : 'Record a voice message'}
              onClick={handleMicClick}
              disabled={disabled || isTranscribing}
              className={cn(
                'relative',
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                isTranscribing && 'text-slate-400 [&_svg]:animate-spin',
              )}
            />
          </div>
        )}

        <IconButton
          icon={Send}
          aria-label="Send message"
          onClick={submit}
          disabled={inputDisabled || value.trim().length === 0}
          className="mb-0.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800"
        />
      </div>
    </div>
  );
}
