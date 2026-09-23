import type { ReviewItem } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { Body, BigNumber, Button, Label, ProgressBar, Title } from '@/components/ui';
import { getConcept, getSkill } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, space } from '@/theme/tokens';

/**
 * A short recall session: up to 10 due concepts, one question each. Answers
 * are submitted as soon as they're chosen. Wrong answers bring the concept
 * back sooner; nothing is ever taken away.
 */
export default function ReviewSessionScreen() {
  const p = useProgress();
  // The queue is fixed for the session so items don't reshuffle as they're answered.
  const [queue] = useState<ReviewItem[]>(() => p.reviewQueue(10));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [xp, setXp] = useState(0);
  const [correct, setCorrect] = useState(0);

  if (queue.length === 0) {
    return (
      <SafeAreaView style={[styles.screen, { padding: space.lg, gap: space.md }]}>
        <Title>Nothing due right now.</Title>
        <Body muted>Go learn something new, or go outside. Both count.</Body>
        <Button variant="secondary" label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (index >= queue.length) {
    return (
      <SafeAreaView style={[styles.screen, { padding: space.lg, gap: space.md }]}>
        <Label tone="success">Review complete</Label>
        <BigNumber tone="brand">+{xp} XP</BigNumber>
        <Title>
          {correct} / {queue.length} recalled
        </Title>
        <Body muted>
          {xp > 0
            ? 'Remembering after a real gap is worth the most XP.'
            : 'Recall XP kicks in when you remember something after a day or more.'}
        </Body>
        <Button label="Done" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const item = queue[index]!;
  const selected = answers[item.question.id];
  const concept = getConcept(item.conceptId);

  const onSelect = (optionId: string) => {
    if (selected !== undefined) return;
    setAnswers({ ...answers, [item.question.id]: optionId });
    const r = p.submitReview(item, optionId);
    setXp(xp + r.xpAwarded);
    if (r.correct) setCorrect(correct + 1);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave review" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={{ flex: 1, gap: space.xs }}>
          <Label>
            Review · {getSkill(item.skillId)?.name} · {index + 1} / {queue.length}
          </Label>
          <ProgressBar value={(index + 1) / queue.length} tone="success" />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body} key={item.question.id}>
        {concept && <Body muted>Refreshing: {concept.title}</Body>}
        <QuestionCard question={item.question} recall selected={selected} onSelect={onSelect} />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={selected === undefined ? 'Choose an answer' : index === queue.length - 1 ? 'Finish review' : 'Continue'}
          disabled={selected === undefined}
          onPress={() => setIndex(index + 1)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  close: { color: color.textMuted, fontSize: 22, fontWeight: '600' },
  body: { padding: space.lg, paddingTop: space.xl, gap: space.lg },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: color.border },
});
