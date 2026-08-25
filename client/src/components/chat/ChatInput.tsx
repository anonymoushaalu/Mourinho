import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';

interface ChatInputProps {
  onSend: (text: string) => void;
  onActiveChange: (active: boolean) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, onActiveChange, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');

  function submit() {
    if (disabled || value.trim().length === 0) return;
    onSend(value);
    setValue('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => onActiveChange(true)}
        onBlur={() => onActiveChange(false)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Ask The Gaffer anything..."
        className="max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <IconButton
        icon={Send}
        aria-label="Send message"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        className="mb-0.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800"
      />
    </div>
  );
}
