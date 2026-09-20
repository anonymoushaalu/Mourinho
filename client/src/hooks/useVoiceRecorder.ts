import { useCallback, useEffect, useRef, useState } from 'react';

import { transcribeAudio } from '@/lib/voice/voiceTransport';

/** Computed once -- browser capability, not something that changes mid-session. */
const isVoiceRecordingSupported =
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function';

export type VoiceRecorderStatus = 'idle' | 'recording' | 'transcribing' | 'error';

interface UseVoiceRecorderOptions {
  /** Called with the transcribed text once transcription succeeds. */
  onTranscribed: (text: string) => void;
}

interface UseVoiceRecorderResult {
  status: VoiceRecorderStatus;
  /** False if this browser lacks MediaRecorder/getUserMedia -- callers should hide or disable the mic button. */
  isSupported: boolean;
  /** Set only when `status === 'error'`; a short, user-facing message. */
  errorMessage: string | null;
  /** Requests mic access and starts recording. No-op if already recording/transcribing. */
  start: () => Promise<void>;
  /** Stops recording and kicks off transcription. No-op unless currently recording. */
  stop: () => void;
}

function messageForMediaError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Microphone access was denied. Allow microphone access in your browser to use voice input.';
      case 'NotFoundError':
        return 'No microphone was found on this device.';
      case 'NotReadableError':
        return 'The microphone is unavailable right now -- it may be in use by another app.';
      case 'SecurityError':
        return 'Microphone access requires a secure connection (HTTPS).';
      default:
        return 'Could not access the microphone.';
    }
  }
  return 'Could not access the microphone.';
}

/**
 * Encapsulates browser mic recording end-to-end: permission request, the
 * MediaRecorder lifecycle, and handing the result off to the transcription
 * backend. UI-agnostic -- callers only get a status enum and a callback with
 * the transcribed text; how that text is displayed/edited is the caller's
 * concern (see `ChatInput`, which drops it into the existing textarea).
 */
export function useVoiceRecorder({
  onTranscribed,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  // `status` is React state, so it only reflects reality after a re-render --
  // `start()` is async and awaits `getUserMedia()` before ever calling
  // `setStatus('recording')`, leaving a real window where a second start()
  // (e.g. a fast double-click) reads the still-stale 'idle' status, passes
  // the guard below, and fires a second getUserMedia() call. That orphans
  // the first MediaStream -- its tracks are never stopped, since
  // `streamRef.current` gets overwritten by the second call before
  // `releaseStream()` ever sees it, leaking an open microphone. This ref is
  // set synchronously, before any `await`, so it closes that window
  // regardless of render timing. Confirmed via direct testing: dispatching
  // two same-tick clicks on the mic button reliably triggered two
  // getUserMedia() calls before this guard existed.
  const startingRef = useRef(false);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      // Unmounting mid-recording/transcription must not leak an open mic or
      // a dangling network request.
      mediaRecorderRef.current?.stop();
      releaseStream();
      abortControllerRef.current?.abort();
    },
    [releaseStream],
  );

  const start = useCallback(async () => {
    if (!isVoiceRecordingSupported) {
      setStatus('error');
      setErrorMessage('Voice input is not supported in this browser.');
      return;
    }
    // Re-entrancy guard: ignore a second start() while already recording,
    // transcribing, or already in the middle of requesting mic access.
    // `startingRef` (not `status`) is what actually closes the race -- see
    // its declaration above.
    if (status === 'recording' || status === 'transcribing' || startingRef.current) return;
    startingRef.current = true;

    setErrorMessage(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      startingRef.current = false;
      setStatus('error');
      setErrorMessage(messageForMediaError(error));
      return;
    }

    startingRef.current = false;
    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      void (async () => {
        releaseStream();

        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (audioBlob.size === 0) {
          setStatus('error');
          setErrorMessage('No audio was recorded. Please try again.');
          return;
        }

        setStatus('transcribing');
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const result = await transcribeAudio(audioBlob, controller.signal);

        if (result.ok) {
          setStatus('idle');
          onTranscribed(result.text);
        } else if (result.error.code !== 'aborted') {
          setStatus('error');
          setErrorMessage(result.error.message);
        }
      })();
    };

    recorder.start();
    setStatus('recording');
  }, [status, onTranscribed, releaseStream]);

  const stop = useCallback(() => {
    if (status !== 'recording') return;
    mediaRecorderRef.current?.stop();
  }, [status]);

  return { status, isSupported: isVoiceRecordingSupported, errorMessage, start, stop };
}
