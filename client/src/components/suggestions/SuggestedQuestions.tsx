import { SuggestionChip } from '@/components/suggestions/SuggestionChip';
import { suggestedQuestions } from '@/data/suggestedQuestions';
import type { SuggestedQuestion } from '@/types';

interface SuggestedQuestionsProps {
  onSelect: (question: SuggestedQuestion) => void;
}

/** Shown only before the first message — seeds the conversation, then gets out of the way. */
export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3" role="group" aria-label="Suggested questions">
      {suggestedQuestions.map((question) => (
        <SuggestionChip key={question.id} question={question} onSelect={onSelect} />
      ))}
    </div>
  );
}
