import { answerFromKnowledge } from '@/lib/chat/knowledgeReplies';
import type { ChatStreamEvent, ChatTransport, ChatTransportMessage } from '@/types/chat-transport';

/** Resolves after `ms`, or immediately once `signal` aborts — never leaves a dangling timer. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Fake `ChatTransport` that simulates token-by-token streaming so the UI's
 * streaming render path is exercised and correct before any real backend
 * exists. `getChatTransport` is the only place that should import this.
 */
export const mockChatTransport: ChatTransport = {
  async *send(message: ChatTransportMessage, signal: AbortSignal): AsyncIterable<ChatStreamEvent> {
    await wait(500, signal);
    if (signal.aborted) return;

    // Dev-only affordance: exercises the error path before any real backend
    // exists, so the avatar's `error` state is actually verifiable end-to-end.
    if (message.content.toLowerCase().includes('error')) {
      yield {
        type: 'error',
        error: {
          code: 'mock_error',
          message: 'This is a simulated failure, for exercising the error state before the real backend exists.',
        },
      };
      return;
    }

    const { text, actions } = answerFromKnowledge(message.content);
    const words = text.split(' ');

    for (let i = 0; i < words.length; i += 1) {
      if (signal.aborted) return;
      const word = words[i];
      if (word === undefined) continue;
      const delta = i === 0 ? word : ` ${word}`;
      yield { type: 'chunk', delta };
      await wait(35, signal);
    }

    if (signal.aborted) return;
    if (actions.length > 0) {
      yield { type: 'navigation-actions', actions };
    }
    yield { type: 'done', messageId: crypto.randomUUID() };
  },
};
