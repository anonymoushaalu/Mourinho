import { useEffect, useRef } from 'react';

import type { ChatMessage } from '@/types';

/** Keeps a scroll container pinned to the bottom as new messages/chunks arrive. */
export function useAutoScroll(messages: ChatMessage[]) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  return ref;
}
