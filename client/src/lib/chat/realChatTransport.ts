import { env } from '@/config/env';
import type { ChatStreamEvent, ChatTransport, ChatTransportMessage } from '@/types/chat-transport';

/**
 * Real `ChatTransport` that calls the backend's /api/v1/chat endpoint.
 * Streams NDJSON (newline-delimited JSON) events matching ChatStreamEvent.
 *
 * The backend streams grounded responses using Claude, ensuring every claim
 * traces back to Jabez's portfolio knowledge — never inventing facts.
 */
export const realChatTransport: ChatTransport = {
  async *send(
    message: ChatTransportMessage,
    signal: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const apiUrl = `${env.apiBaseUrl}/api/v1/chat`;

    let response: Response | null = null;

    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message.content }),
        signal,
      });

      if (!response.ok) {
        yield {
          type: 'error',
          error: {
            code: 'api_error',
            message: `Backend error: ${response.status} ${response.statusText}`,
          },
        };
        return;
      }

      if (!response.body) {
        yield {
          type: 'error',
          error: {
            code: 'no_response_body',
            message: 'Backend returned no response body.',
          },
        };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Drain any remaining buffered line
            if (buffer.trim()) {
              const event = JSON.parse(buffer) as ChatStreamEvent;
              yield event;
            }
            break;
          }

          // Decode chunk and append to buffer
          buffer += decoder.decode(value, { stream: true });

          // Split on newlines and process complete lines
          const lines = buffer.split('\n');
          buffer = lines[lines.length - 1] || '';

          for (let i = 0; i < lines.length - 1; i += 1) {
            const line = lines[i] ?? '';
            if (!line.trim()) continue;

            try {
              const event = JSON.parse(line) as ChatStreamEvent;
              yield event;
            } catch (e) {
              console.error('Failed to parse NDJSON line:', line, e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (e) {
      // Network error, abort, or parsing failure
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
    }
  },
};
