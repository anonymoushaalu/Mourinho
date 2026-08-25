import { MessageBubble } from '@/components/chat/MessageBubble';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { ChatMessage } from '@/types';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const scrollRef = useAutoScroll(messages);

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
