import type { ApiError, components } from '@mourinho/shared';

import { env } from '@/config/env';
import type {
  ChatStreamEvent,
  ChatTransport,
  ChatTransportHistoryTurn,
  ChatTransportMessage,
} from '@/types/chat-transport';

type ChatCompletionRequest = components['schemas']['ChatCompletionRequest'];
type ChatCompletionResponse = components['schemas']['ChatCompletionResponse'];

/**
 * Real `ChatTransport` that calls the backend's non-streaming
 * /api/v1/chat/complete endpoint, sending the prior conversation as
 * `history` so The Gaffer has real multi-turn memory (the streaming
 * /api/v1/chat endpoint intentionally stays untouched -- see
 * `server/app/api/v1/routes/chat.py` -- and remains stateless per-turn).
 *
 * The endpoint itself doesn't stream, but `ChatTransport.send()` still
 * returns an `AsyncIterable<ChatStreamEvent>` -- this yields the full reply
 * as a single `chunk`, then `done`, so `useChatSession`'s reducer and every
 * UI component downstream (typing indicator, streaming cursor) work exactly
 * as they did against the streaming transport, unmodified.
 */
export const realChatTransport: ChatTransport = {
  async *send(
    message: ChatTransportMessage,
    history: ChatTransportHistoryTurn[],
    signal: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const apiUrl = `${env.apiBaseUrl}/api/v1/chat/complete`;

    const body: ChatCompletionRequest = {
      content: message.content,
      history,
    };

    let response: Response;

    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Request was cancelled by the user; don't emit an error
        return;
      }

      yield {
        type: 'error',
        error: {
          code: 'network_error',
          message: `Failed to reach the backend: ${e instanceof Error ? e.message : String(e)}`,
        },
      };
      return;
    }

    if (!response.ok) {
      const apiError = await parseApiError(response);
      yield {
        type: 'error',
        error: apiError ?? {
          code: 'api_error',
          message: `Backend error: ${response.status} ${response.statusText}`,
        },
      };
      return;
    }

    let payload: ChatCompletionResponse;
    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch (e) {
      yield {
        type: 'error',
        error: {
          code: 'invalid_response',
          message: `Backend returned an unreadable response: ${e instanceof Error ? e.message : String(e)}`,
        },
      };
      return;
    }

    yield { type: 'chunk', delta: payload.message.content };
    yield { type: 'done', messageId: payload.messageId };
  },
};

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
      const requestId = 'requestId' in body && typeof body.requestId === 'string' ? body.requestId : '';
      return { code: body.code, message: body.message, requestId };
    }
    return null;
  } catch {
    return null;
  }
}
