import { env } from '@/config/env';
import { mockChatTransport } from '@/lib/chat/mockChatTransport';
import { realChatTransport } from '@/lib/chat/realChatTransport';
import type { ChatTransport } from '@/types/chat-transport';

/**
 * The single seam between chat UI and however replies actually arrive.
 * `useChatSession` calls this and only this.
 *
 * Chooses between:
 * - `realChatTransport` (default): calls the backend's /api/v1/chat endpoint
 * - `mockChatTransport` (if VITE_USE_MOCK_TRANSPORT=true): uses canned responses
 *
 * Swapping in a different transport later means changing only this function.
 */
export function getChatTransport(): ChatTransport {
  return env.useMockTransport ? mockChatTransport : realChatTransport;
}
