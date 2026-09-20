import type { ApiError, components } from '@mourinho/shared';

import { env } from '@/config/env';

type TranscribeResponse = components['schemas']['TranscribeResponse'];
type SpeakRequest = components['schemas']['SpeakRequest'];

/** Discriminated result, not a thrown exception -- callers must handle both outcomes explicitly. */
export type TranscribeResult =
  { ok: true; text: string } | { ok: false; error: { code: string; message: string } };

/**
 * Calls the backend's /api/v1/voice/transcribe endpoint with recorded audio.
 * Mirrors `realChatTransport`'s error-handling shape (network error, uniform
 * backend error envelope, unreadable response) but as a single request/response
 * rather than an `AsyncIterable`, since transcription has no streaming concept.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  signal: AbortSignal,
): Promise<TranscribeResult> {
  const apiUrl = `${env.apiBaseUrl}/api/v1/voice/transcribe`;

  const formData = new FormData();
  // Filename/type drive the backend's content-type allow-list; MediaRecorder
  // typically produces audio/webm, so that's the safe default extension.
  const extension = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  formData.append('audio', audioBlob, `recording.${extension}`);

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, error: { code: 'aborted', message: 'Recording cancelled.' } };
    }
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: `Failed to reach the backend: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  if (!response.ok) {
    const apiError = await parseApiError(response);
    return {
      ok: false,
      error: apiError ?? {
        code: 'api_error',
        message: `Backend error: ${response.status} ${response.statusText}`,
      },
    };
  }

  try {
    const payload = (await response.json()) as TranscribeResponse;
    return { ok: true, text: payload.text };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: `Backend returned an unreadable response: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }
}

/** Discriminated result, not a thrown exception -- same shape as `TranscribeResult`. */
export type SpeakResult =
  { ok: true; audioBlob: Blob } | { ok: false; error: { code: string; message: string } };

/**
 * Calls the backend's /api/v1/voice/speak endpoint. Unlike `transcribeAudio`,
 * the success response is raw audio bytes, not JSON -- only the error path
 * (via the uniform backend error envelope, always JSON regardless of the
 * route's normal response type) is parsed as such.
 */
export async function speakText(text: string, signal: AbortSignal): Promise<SpeakResult> {
  const apiUrl = `${env.apiBaseUrl}/api/v1/voice/speak`;
  const body: SpeakRequest = { text };

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, error: { code: 'aborted', message: 'Speech cancelled.' } };
    }
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: `Failed to reach the backend: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  if (!response.ok) {
    const apiError = await parseApiError(response);
    return {
      ok: false,
      error: apiError ?? {
        code: 'api_error',
        message: `Backend error: ${response.status} ${response.statusText}`,
      },
    };
  }

  try {
    const audioBlob = await response.blob();
    if (audioBlob.size === 0) {
      return { ok: false, error: { code: 'empty_audio', message: 'Backend returned no audio.' } };
    }
    return { ok: true, audioBlob };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: `Backend returned unreadable audio: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }
}

/** Parses the backend's uniform error envelope; returns null if the body doesn't match it. */
async function parseApiError(response: Response): Promise<ApiError | null> {
  try {
    const body: unknown = await response.json();
    if (
      body !== null &&
      typeof body === 'object' &&
      'code' in body &&
      'message' in body &&
      typeof body.code === 'string' &&
      typeof body.message === 'string'
    ) {
      const requestId =
        'requestId' in body && typeof body.requestId === 'string' ? body.requestId : '';
      return { code: body.code, message: body.message, requestId };
    }
    return null;
  } catch {
    return null;
  }
}
