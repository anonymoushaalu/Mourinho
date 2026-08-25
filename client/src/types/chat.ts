import type { IsoTimestamp } from '@mourinho/shared';

import type { NavigationAction } from '@/types/navigation-action';

export type ChatRole = 'user' | 'assistant';

/**
 * Lifecycle of a single assistant message as it streams in. `pending` covers
 * the gap between send and first token, so the UI has something to render
 * (a typing indicator) before any text exists.
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: MessageStatus;
  createdAt: IsoTimestamp;
  /** Only assistant messages carry these; populated once the stream completes. */
  actions?: NavigationAction[];
  /** Set when `status` is `'error'`, human-readable. */
  errorMessage?: string;
}
