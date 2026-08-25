import type { NavigationAction } from '@/types/navigation-action';

export interface ChatTransportMessage {
  role: 'user';
  content: string;
}

/**
 * Discriminated union so the reducer driving `useChatSession` can exhaustively
 * switch on `type` and TypeScript flags any new variant left unhandled.
 */
export type ChatStreamEvent =
  | { type: 'chunk'; delta: string }
  | { type: 'navigation-actions'; actions: NavigationAction[] }
  | { type: 'done'; messageId: string }
  | { type: 'error'; error: { code: string; message: string } };

/**
 * The seam between chat UI and however replies actually arrive. An
 * `AsyncIterable` is the shape both a mocked `setTimeout` stream and a real
 * SSE/WebSocket transport can produce uniformly, so `useChatSession` can
 * `for await` over either without knowing which one it's holding.
 */
export interface ChatTransport {
  send(message: ChatTransportMessage, signal: AbortSignal): AsyncIterable<ChatStreamEvent>;
}
