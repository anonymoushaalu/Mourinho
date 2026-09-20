import { useCallback, useEffect, useRef, useState } from 'react';

import { speakText } from '@/lib/voice/voiceTransport';

export type VoiceOutputStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface UseVoiceOutputResult {
  /** Whether The Gaffer's replies should be spoken aloud. Off by default -- audio should never start unprompted. */
  enabled: boolean;
  toggleEnabled: () => void;
  status: VoiceOutputStatus;
  errorMessage: string | null;
  /** Fetches and plays TTS audio for `text`. No-op for blank text. */
  speak: (text: string) => void;
  /** Cancels any in-flight request and stops playback immediately. */
  stop: () => void;
}

/**
 * Encapsulates TTS playback: fetching audio from the backend and playing it
 * via an `HTMLAudioElement`, with the same resource-cleanup and re-entrancy
 * discipline as `useVoiceRecorder` -- an object URL or an in-flight request
 * left dangling is exactly the class of bug the Phase 5E audit found and
 * fixed on the recording side. UI-agnostic: callers get a status enum and
 * call `speak(text)`; deciding *when* to call it (e.g. on a newly-completed
 * assistant message) is the caller's concern.
 */
export function useVoiceOutput(): UseVoiceOutputResult {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<VoiceOutputStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.src = '';
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    releaseAudio();
    setStatus('idle');
  }, [releaseAudio]);

  useEffect(
    () => () => {
      // Unmounting mid-request/playback must not leak a blob URL or a
      // dangling network request.
      abortControllerRef.current?.abort();
      releaseAudio();
    },
    [releaseAudio],
  );

  const speak = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Interrupt any in-flight request or currently-playing audio -- one
      // utterance at a time, matching the abort-on-resend pattern already
      // used by useChatSession and useVoiceRecorder.
      abortControllerRef.current?.abort();
      releaseAudio();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setErrorMessage(null);
      setStatus('loading');

      void (async () => {
        const result = await speakText(trimmed, controller.signal);
        // A newer speak()/stop() call may have already superseded this one
        // by the time the request resolves -- stale results are discarded.
        if (abortControllerRef.current !== controller) return;

        if (!result.ok) {
          if (result.error.code === 'aborted') return;
          setStatus('error');
          setErrorMessage(result.error.message);
          return;
        }

        const url = URL.createObjectURL(result.audioBlob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          if (abortControllerRef.current === controller) {
            releaseAudio();
            setStatus('idle');
          }
        };
        audio.onerror = () => {
          if (abortControllerRef.current === controller) {
            releaseAudio();
            setStatus('error');
            setErrorMessage('Playback failed.');
          }
        };

        try {
          await audio.play();
          if (abortControllerRef.current === controller) setStatus('playing');
        } catch {
          // Browsers can block autoplay outside a direct user gesture --
          // surface it rather than fail silently with no audio and no clue why.
          if (abortControllerRef.current === controller) {
            setStatus('error');
            setErrorMessage('Playback was blocked by the browser.');
          }
        }
      })();
    },
    [releaseAudio],
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((previous) => {
      const next = !previous;
      if (!next) stop(); // turning voice off mid-playback should cut audio immediately
      return next;
    });
  }, [stop]);

  return { enabled, toggleEnabled, status, errorMessage, speak, stop };
}
