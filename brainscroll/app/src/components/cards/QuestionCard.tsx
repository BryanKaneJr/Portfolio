import type { Card, Question } from '@brainscroll/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Label } from '@/components/ui';
import type { AttemptView } from '@/progress/ProgressProvider';
import { color, radius, space } from '@/theme/tokens';
import { LearningCard } from './LearningCard';

/**
 * A question inside a level. Learning first, testing second:
 *
 * - Right first time → "Correct" + the explanation.
 * - Wrong → a restrained note, then "Take another look": the question's source
 *   cards, shown right here beneath it. The options stay open (the wrong picks
 *   are crossed out) until the right answer is chosen. No lives, no restart,
 *   no failure screen.
 *
 * Correctness always comes from graded attempts (server-side when online),
 * never from the bundle. Only the first attempt counts toward XP.
 */
export function QuestionCard({
  question,
  recall,
  attempts,
  sourceCards,
  busy,
  onSelect,
  reveal,
}: {
  question: Question;
  recall: boolean;
  attempts: AttemptView[];
  sourceCards: Card[];
  busy: boolean;
  onSelect: (optionId: string) => void;
  /** Review mode: a single attempt, then show the right answer instead of reinforcing. */
  reveal?: { correctOptionId: string; explanation: string };
}) {
  const resolvedBy = attempts.find((a) => a.correct);
  const wrong = new Set(attempts.filter((a) => !a.correct).map((a) => a.optionId));
  const last = attempts.at(-1);
  const reviewDone = reveal !== undefined && attempts.length > 0;
  const locked = !!resolvedBy || reviewDone || busy;
  const needsAnotherLook = !resolvedBy && !reveal && last && !last.correct;
  const correctId = resolvedBy?.optionId ?? (reviewDone ? reveal.correctOptionId : undefined);

  return (
    <View style={{ gap: space.md }}>
      <Label tone={recall ? 'success' : 'brand'}>{recall ? 'Recall · from an earlier level' : 'Question'}</Label>
      <Text style={styles.prompt}>{question.prompt}</Text>

      {needsAnotherLook && (
        <View style={styles.lookAgain} accessibilityLiveRegion="polite">
          <Text style={styles.notQuite}>Not quite{last.rationale ? `: ${last.rationale}` : '.'}</Text>
          <Label tone="brand">Take another look</Label>
          {sourceCards.map((c) => (
            <View key={c.id} style={styles.evidence}>
              <LearningCard card={c} />
            </View>
          ))}
          <Body muted>Then choose again.</Body>
        </View>
      )}

      <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
        {question.options.map((o) => {
          const isCorrect = o.id === correctId;
          const isWrong = wrong.has(o.id);
          const state = isCorrect ? 'correct' : isWrong ? 'wrong' : locked ? 'dim' : 'idle';
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isCorrect || isWrong, disabled: locked || isWrong }}
              disabled={locked || isWrong}
              onPress={() => onSelect(o.id)}
              style={({ pressed }) => [styles.option, styles[state], pressed && { transform: [{ scale: 0.99 }] }]}>
              <Text style={[styles.optionText, (state === 'dim' || state === 'wrong') && { color: color.textMuted }]}>{o.label}</Text>
              {state === 'correct' && <Text style={[styles.mark, { color: color.success }]}>✓</Text>}
              {state === 'wrong' && <Text style={[styles.mark, { color: color.danger }]}>✗</Text>}
            </Pressable>
          );
        })}
      </View>

      {resolvedBy && (
        <View style={[styles.feedback, { borderColor: color.success }]} accessibilityLiveRegion="polite">
          <Text style={[styles.verdict, { color: color.success }]}>{attempts.length === 1 ? 'Correct' : 'Reinforced'}</Text>
          {resolvedBy.explanation ? <Body>{resolvedBy.explanation}</Body> : null}
          {attempts.length > 1 && <Body muted>We’ll bring this back later so it sticks.</Body>}
        </View>
      )}

      {reviewDone && (
        <View style={[styles.feedback, { borderColor: resolvedBy ? color.success : color.danger }]} accessibilityLiveRegion="polite">
          <Text style={[styles.verdict, { color: resolvedBy ? color.success : color.danger }]}>{resolvedBy ? 'Correct' : 'Quick refresher'}</Text>
          <Body>{reveal.explanation}</Body>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { color: color.text, fontSize: 21, fontWeight: '700', lineHeight: 28 },
  option: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idle: { borderColor: color.border, backgroundColor: color.surfaceRaised },
  correct: { borderColor: color.success, backgroundColor: 'rgba(57,217,138,0.12)' },
  wrong: { borderColor: 'rgba(255,107,107,0.5)', backgroundColor: color.surface },
  dim: { borderColor: color.border, backgroundColor: color.surface },
  optionText: { color: color.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  mark: { fontSize: 18, fontWeight: '800', marginLeft: space.sm },
  lookAgain: { gap: space.sm, borderLeftWidth: 3, borderLeftColor: color.brand, paddingLeft: space.md },
  notQuite: { color: color.danger, fontSize: 15, fontWeight: '700' },
  evidence: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: color.border },
  feedback: { borderLeftWidth: 3, paddingLeft: space.md, gap: space.xs },
  verdict: { fontSize: 16, fontWeight: '800' },
});
