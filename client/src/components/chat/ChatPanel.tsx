import { X } from 'lucide-react';

import { AvatarRenderer } from '@/components/avatar/AvatarRenderer';
import { AvatarStatus } from '@/components/avatar/AvatarStatus';
import { ChatInput } from '@/components/chat/ChatInput';
import type { GafferSessionProps } from '@/components/chat/ChatWidget';
import { MessageList } from '@/components/chat/MessageList';
import { SuggestedQuestions } from '@/components/suggestions/SuggestedQuestions';
import { IconButton } from '@/components/ui/IconButton';
import type { SuggestedQuestion } from '@/types';

interface ChatPanelProps extends GafferSessionProps {
  onClose: () => void;
}

export function ChatPanel({ messages, avatarState, isBusy, sendMessage, setInputActive, onClose }: ChatPanelProps) {
  function handleSuggestionSelect(question: SuggestedQuestion) {
    sendMessage(question.text);
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-700">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <AvatarRenderer state={avatarState} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">The Gaffer</p>
          <AvatarStatus state={avatarState} />
        </div>
        <IconButton icon={X} aria-label="Close chat" onClick={onClose} />
      </header>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col justify-end overflow-y-auto">
          <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            Ask about projects, experience, or how to get in touch.
          </p>
          <SuggestedQuestions onSelect={handleSuggestionSelect} />
        </div>
      ) : (
        <MessageList messages={messages} />
      )}

      <ChatInput onSend={sendMessage} onActiveChange={setInputActive} disabled={isBusy} />
    </div>
  );
}
