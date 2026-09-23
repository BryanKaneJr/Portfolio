import type { Question } from '@brainscroll/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Label } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';

/**
 * Answer once, get immediate feedback and the explanation. Wrong answers
 * teach — no lives, no lockout — and the choice is locked after answering.
 */
export function QuestionCard({
  question,
  recall,
  selected,
  onSelect,
}: {
  question: Question;
  recall: boolean;
  selected: string | undefined;
  onSelect: (optionId: string) => void;
}) {
  const answered = selected !== undefined;
  const chosen = question.options.find((o) => o.id === selected);
  const correct = chosen?.correct ?? false;

  return (
    <View style={{ gap: space.md }}>
      <Label tone={recall ? 'success' : 'brand'}>{recall ? 'Recall · from an earlier level' : 'Question'}</Label>
      <Text style={styles.prompt}>{question.prompt}</Text>

      <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
        {question.options.map((o) => {
          const isChosen = o.id === selected;
          const state = !answered ? 'idle' : o.correct ? 'correct' : isChosen ? 'wrong' : 'dim';
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isChosen, disabled: answered }}
              disabled={answered}
              onPress={() => onSelect(o.id)}
              style={({ pressed }) => [styles.option, styles[state], pressed && { transform: [{ scale: 0.99 }] }]}>
              <Text style={[styles.optionText, state === 'dim' && { color: color.textMuted }]}>{o.label}</Text>
              {state === 'correct' && <Text style={[styles.mark, { color: color.success }]}>✓</Text>}
              {state === 'wrong' && <Text style={[styles.mark, { color: color.danger }]}>✗</Text>}
            </Pressable>
          );
        })}
      </View>

      {answered && (
        <View style={[styles.feedback, { borderColor: correct ? color.success : color.danger }]} accessibilityLiveRegion="polite">
          <Text style={[styles.verdict, { color: correct ? color.success : color.danger }]}>{correct ? 'Correct' : 'Not quite'}</Text>
          {!correct && chosen?.rationale && <Body muted>{chosen.rationale}</Body>}
          <Body>{question.explanation}</Body>
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
  wrong: { borderColor: color.danger, backgroundColor: 'rgba(255,107,107,0.12)' },
  dim: { borderColor: color.border, backgroundColor: color.surface },
  optionText: { color: color.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  mark: { fontSize: 18, fontWeight: '800', marginLeft: space.sm },
  feedback: { borderLeftWidth: 3, paddingLeft: space.md, gap: space.xs },
  verdict: { fontSize: 16, fontWeight: '800' },
});
