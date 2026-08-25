import type { SuggestedQuestion } from '@/types';

interface SuggestionChipProps {
  question: SuggestedQuestion;
  onSelect: (question: SuggestedQuestion) => void;
}

export function SuggestionChip({ question, onSelect }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(question)}
      className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-700"
    >
      {question.text}
    </button>
  );
}
