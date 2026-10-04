import { blankParts, optionLetter, shuffledOptions, type Card, type Question } from '@brainscroll/core';
import { View } from 'react-native';
import { AnswerOption, Body, EvidenceBlock, Eyebrow, FeedbackPanel, H2, RadioGroup, type AnswerState } from '@/components/ui';
import type { AttemptView } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';
import { MatchQuestion, OrderQuestion } from './ArrangeQuestions';
import { FillBlankQuestion } from './FillBlank';
import { LearningCard } from './LearningCard';

/**
 * A question, full-screen and tactile. Learning first, testing second:
 *
 *   select an answer card → CHECK (in the lesson footer) → graded in context.
 *   - Right → the card turns mint and the footer says so; CONTINUE.
 *   - Wrong → the pick is crossed out, the footer says "Not quite", and
 *     "Take another look" shows the question's source cards right under the
 *     choices, which stay in view. Choose again until right. No lives, no restart, no failure screen,
 *     and the answer is never simply revealed.
 *
 * Only the first CHECK counts toward XP (recorded server-side when online);
 * selecting without checking records nothing. Match and order questions
 * (ArrangeQuestions) work the same way: arrange, CHECK, fix what's marked.
 * A multiple-choice prompt with a gap ("_____") is a fill-in-the-blank
 * (FillBlank): same grading, but the pick drops into the sentence.
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
  const stateOf = (id: string): AnswerState =>
    id === s.resolvedBy?.optionId
      ? 'correct'
      : wrong.has(id)
        ? 'eliminated'
        : busy && id === selected
          ? 'checking'
          : s.resolved || busy
            ? 'locked'
            : id === selected
              ? 'selected'
              : 'idle';
  const blank = question.kind === 'mcq' ? blankParts(question.prompt) : null;

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Eyebrow tone={recall ? 'success' : 'brand'}>{recall ? 'Recall · from an earlier level' : PURPOSE[question.purpose]}</Eyebrow>
        {!blank && <H2>{question.prompt}</H2>}
        {question.kind !== 'mcq' && <Body muted>{question.kind === 'match' ? 'Tap one on each side to pair them.' : 'Drag the handles, or tap two to swap them.'}</Body>}
      </View>

      {question.kind === 'order' ? (
        <OrderQuestion key={question.id} question={question} attempts={attempts} busy={busy} onSelect={onSelect} />
      ) : question.kind === 'match' ? (
        <MatchQuestion key={question.id} question={question} attempts={attempts} busy={busy} onSelect={onSelect} />
      ) : blank ? (
        <FillBlankQuestion key={question.id} question={question} before={blank.before} after={blank.after} stateOf={stateOf} onSelect={onSelect} />
      ) : (
        // Shown in a stable shuffled order (core shuffledOptions), lettered as shown; picks still travel by option id.
        <RadioGroup label={question.prompt}>
          {shuffledOptions(question).map((o, i) => (
            <AnswerOption key={o.id} letter={optionLetter(i)} label={o.label} state={stateOf(o.id)} onPress={() => onSelect(o.id)} />
          ))}
        </RadioGroup>
      )}

      {/* Under the choices, so a miss never pushes them off screen (UX review C2). */}
      {s.needsAnotherLook && (
        <EvidenceBlock>
          {sourceCards.map((c) => (
            <LearningCard key={c.id} card={c} compact />
          ))}
        </EvidenceBlock>
      )}
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
  // Keyed by attempt, so every verdict (even a second "Not quite") arrives and is announced afresh.
  if (s.resolvedBy) {
    // Right first time here, but a level left partway and started again keeps its first answers: a miss then still counts.
    const missedBefore = s.firstTry && s.resolvedBy.firstAttemptCorrect === false;
    return (
      <FeedbackPanel key={attempts.length} tone="success" mascot="feedback.correct" title={s.firstTry && !missedBefore ? 'Correct' : 'Got it: reinforced'}>
        {s.resolvedBy.explanation ? <Body>{s.resolvedBy.explanation}</Body> : null}
        {missedBefore ? (
          <Body muted>Your first answer from last time still counts, so we’ll bring this back later.</Body>
        ) : (
          !s.firstTry && <Body muted>We’ll bring this back later so it sticks.</Body>
        )}
      </FeedbackPanel>
    );
  }
  if (s.lastWrong)
    return (
      <FeedbackPanel key={attempts.length} tone="reinforce" mascot="feedback.wrong" title="Not quite">
        <Body>{wrongLine(s.lastWrong)} Take another look, then {s.lastWrong.wrong ? 'try again' : 'choose again'}.</Body>
      </FeedbackPanel>
    );
  return null;
}

/** What a miss says: the option's own rationale, or how many places in an arrangement are off. */
function wrongLine(a: AttemptView): string {
  if (a.rationale) return a.rationale;
  if (a.wrong) return a.wrong.length === 1 ? 'One is in the wrong place.' : `${a.wrong.length} are in the wrong place.`;
  return 'That one doesn’t fit.';
}

/**
 * Whether CHECK is live: something is chosen, and it isn't an answer already
 * checked (an arrangement put back the way it was checked). Same everywhere a
 * question is asked, so CHECK is never a button that silently does nothing.
 */
export const canCheck = (attempts: AttemptView[], selected: string | undefined): selected is string => !!selected && !attempts.some((a) => a.optionId === selected);

export function feedbackTone(attempts: AttemptView[]): 'success' | 'reinforce' | undefined {
  const s = questionStatus(attempts);
  return s.resolved ? 'success' : s.lastWrong ? 'reinforce' : undefined;
}
