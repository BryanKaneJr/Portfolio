import type { Card, Level } from '@brainscroll/core';
import type { AttemptView } from '@/progress/ProgressProvider';
import { LearningCard } from './LearningCard';
import { QuestionCard } from './QuestionCard';

/**
 * Renders any card from data, keyed by card.type. Levels never get bespoke UI.
 * Question cards get their evidence cards (question.sourceCardIds) resolved by
 * the caller, so a wrong answer can show the canonical teaching content.
 */
export function CardRenderer({
  card,
  level,
  attempts,
  selected,
  busy,
  resolveCard,
  onSelect,
}: {
  card: Card;
  level: Level;
  attempts: AttemptView[];
  selected?: string;
  busy: boolean;
  resolveCard: (cardId: string) => Card | undefined;
  onSelect: (optionId: string) => void;
}) {
  if (card.type === 'mcq' || card.type === 'recall') {
    const question = level.questions.find((q) => q.id === card.questionId);
    if (!question) return null;
    const sourceCards = question.sourceCardIds.map(resolveCard).filter((c): c is Card => !!c);
    return (
      <QuestionCard
        question={question}
        recall={card.type === 'recall'}
        attempts={attempts}
        selected={selected}
        sourceCards={sourceCards}
        busy={busy}
        onSelect={onSelect}
      />
    );
  }
  return <LearningCard card={card} />;
}
