import type { Card, Question } from '@brainscroll/core';
import { View } from 'react-native';
import { AnswerOption, Body, EvidenceBlock, Eyebrow, FeedbackPanel, H2, type AnswerState } from '@/components/ui';
import type { AttemptView } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';
import { LearningCard } from './LearningCard';

/**
 * A question, full-screen and tactile. Learning first, testing second:
 *
 *   select an answer card → CHECK (in the lesson footer) → graded in context.
 *   - Right → the card turns mint and the footer says so; CONTINUE.
 *   - Wrong → the pick is crossed out, the footer says "Not quite", and
 *     "Take another look" shows the question's source cards right under the
 *     prompt. Choose again until right. No lives, no restart, no failure screen,
 *     and the answer is never simply revealed.
 *
 * Only the first CHECK counts toward XP (recorded server-side when online);
 * selecting without checking records nothing.
 */
export function QuestionCard({
  question,
  recall,
  attempts,
  selected,
  sourceCards,
  busy,
  onSelect,
}: {
  question: Question;
  recall: boolean;
  attempts: AttemptView[];
  selected?: string;
  sourceCards: Card[];
  busy: boolean;
  onSelect: (optionId: string) => void;
}) {
  const s = questionStatus(attempts);
  const wrong = new Set(attempts.filter((a) => !a.correct).map((a) => a.optionId));

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Eyebrow tone={recall ? 'success' : 'brand'}>{recall ? 'Recall · from an earlier level' : PURPOSE[question.purpose]}</Eyebrow>
        <H2>{question.prompt}</H2>
      </View>

      {s.needsAnotherLook && (
        <EvidenceBlock>
          {sourceCards.map((c) => (
            <LearningCard key={c.id} card={c} compact />
          ))}
        </EvidenceBlock>
      )}

      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        {question.options.map((o) => {
          const state: AnswerState =
            o.id === s.resolvedBy?.optionId ? 'correct' : wrong.has(o.id) ? 'eliminated' : s.resolved || busy ? 'locked' : o.id === selected ? 'selected' : 'idle';
          return <AnswerOption key={o.id} letter={o.id} label={o.label} state={state} onPress={() => onSelect(o.id)} />;
        })}
      </View>
    </View>
  );
}

const PURPOSE = { recall: 'Remember', understanding: 'Understand', connection: 'Connect' } as const;

export function questionStatus(attempts: AttemptView[]) {
  const resolvedBy = attempts.find((a) => a.correct);
  const last = attempts.at(-1);
  return {
    resolvedBy,
    resolved: !!resolvedBy,
    firstTry: !!resolvedBy && attempts.length === 1,
    needsAnotherLook: !resolvedBy && !!last && !last.correct,
    lastWrong: !resolvedBy && last && !last.correct ? last : undefined,
  };
}

/**
 * The footer verdict for a question, shown above the lesson's primary action.
 * Returns null while the learner is still choosing.
 */
export function QuestionFeedback({ attempts }: { attempts: AttemptView[] }) {
  const s = questionStatus(attempts);
  if (s.resolvedBy)
    return (
      <FeedbackPanel tone="success" mascot="feedback.correct" title={s.firstTry ? 'Correct' : 'Got it: reinforced'}>
        {s.resolvedBy.explanation ? <Body>{s.resolvedBy.explanation}</Body> : null}
        {!s.firstTry && <Body muted>We’ll bring this back later so it sticks.</Body>}
      </FeedbackPanel>
    );
  if (s.lastWrong)
    return (
      <FeedbackPanel tone="reinforce" mascot="feedback.wrong" title="Not quite">
        <Body>{s.lastWrong.rationale ?? 'That one doesn’t fit.'} Take another look above, then choose again.</Body>
      </FeedbackPanel>
    );
  return null;
}

export function feedbackTone(attempts: AttemptView[]): 'success' | 'reinforce' | undefined {
  const s = questionStatus(attempts);
  return s.resolved ? 'success' : s.lastWrong ? 'reinforce' : undefined;
}
