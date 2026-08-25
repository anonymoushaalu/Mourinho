import { motion } from 'framer-motion';

import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { NavigationActionList } from '@/components/navigation/NavigationActionList';
import { cn } from '@/lib/cn';
import type { ChatMessage } from '@/types';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isPendingEmpty = message.status === 'pending' && message.content === '';
  const isError = message.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser && 'rounded-br-sm bg-indigo-600 text-white',
          !isUser && !isError && 'rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
          isError &&
            'rounded-bl-sm border border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
        )}
      >
        {isPendingEmpty ? (
          <TypingIndicator />
        ) : (
          <>
            <span className="whitespace-pre-wrap">{message.content}</span>
            {message.status === 'streaming' && (
              <span
                className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-current align-middle"
                aria-hidden="true"
              />
            )}
            {isError && message.errorMessage && <p className="mt-1 text-xs opacity-80">{message.errorMessage}</p>}
          </>
        )}
        {message.status === 'complete' && message.actions && message.actions.length > 0 && (
          <NavigationActionList actions={message.actions} />
        )}
      </div>
    </motion.div>
  );
}
