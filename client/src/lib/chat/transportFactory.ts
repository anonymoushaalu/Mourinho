import { mockChatTransport } from '@/lib/chat/mockChatTransport';
import type { ChatTransport } from '@/types/chat-transport';

/**
 * The single seam between chat UI and however replies actually arrive.
 * `useChatSession` calls this and only this — swapping in a real SSE/WS
 * transport later means changing the body of this function, nothing that
 * calls it.
 */
export function getChatTransport(): ChatTransport {
  return mockChatTransport;
}
