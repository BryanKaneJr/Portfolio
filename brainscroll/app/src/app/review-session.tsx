import { REVIEW_SESSION_MAX_QUESTIONS, XP, type Card, type ReviewItem } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { Body, BigNumber, Button, Label, ProgressBar, Title } from '@/components/ui';
import { getCard, getConcept, getSkill } from '@/content';
import { useProgress, type AttemptView } from '@/progress/ProgressProvider';
import { color, space } from '@/theme/tokens';

/**
 * A short recall session: up to REVIEW_SESSION_MAX_QUESTIONS due concepts, one
 * question each. Works like a level question: the first attempt is recorded
 * (+10 XP if right, once per scheduled review); a miss shows the question's
 * source cards beneath it and the choices stay open until the right answer is
 * chosen. The answer is never simply revealed, corrections earn nothing, and
 * nothing is ever taken away.
 */
export default function ReviewSessionScreen() {
  const p = useProgress();
  // The queue is fixed for the session so items don't reshuffle as they're answered.
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const [index, setIndex] = useState(0);
  // Every graded attempt per review question, as the server judged it.
  const [attempts, setAttempts] = useState<Record<string, AttemptView[]>>({});
  // Items the server couldn't be reached for: let them move on; they stay due.
  const [unreachable, setUnreachable] = useState<Record<string, boolean>>({});
  const [answering, setAnswering] = useState(false);
  const [xp, setXp] = useState(0);
  const [firstTry, setFirstTry] = useState(0);

  useEffect(() => {
    if (!p.ready) return;
    p.reviewQueue(REVIEW_SESSION_MAX_QUESTIONS).then(setQueue, () => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ready]);

  // Refresh Home/Review counts once the session is over.
  const finish = () => {
    void p.refresh();
    router.back();
  };

  if (failed) {
    return (
      <SafeAreaView style={[styles.screen, { padding: space.lg, gap: space.md }]}>
        <Title>Couldn’t load your review.</Title>
        <Body muted>Check your connection and try again.</Body>
        <Button variant="secondary" label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }
  if (queue === null) return <SafeAreaView style={styles.screen} />;

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
          {firstTry} / {queue.length} right first time
        </Title>
        <Body muted>
          {firstTry === queue.length
            ? `+${XP.REVIEW_FIRST_ATTEMPT} XP for each one you remembered on the first try.`
            : `+${XP.REVIEW_FIRST_ATTEMPT} XP for each one you remembered on the first try. The ones you corrected will come back sooner.`}
        </Body>
        <Button label="Done" onPress={finish} />
      </SafeAreaView>
    );
  }

  const item = queue[index]!;
  const itemAttempts = attempts[item.question.id] ?? [];
  const resolved = itemAttempts.some((a) => a.correct) || !!unreachable[item.question.id];
  const concept = getConcept(item.conceptId);
  const sourceCards = item.question.sourceCardIds.map(getCard).filter((c): c is Card => !!c);

  const onSelect = (optionId: string) => {
    if (resolved || inFlight.current) return;
    inFlight.current = true;
    setAnswering(true);
    const qid = item.question.id;
    p.submitReview(item, optionId)
      .then((r) => {
        setAttempts((m) => ({ ...m, [qid]: [...(m[qid] ?? []), { optionId, correct: r.correct, rationale: r.rationale, explanation: r.explanation }] }));
        setXp((x) => x + r.xpAwarded);
        if (r.correct && r.attemptCount <= 1) setFirstTry((c) => c + 1);
      })
      .catch(() => setUnreachable((m) => ({ ...m, [qid]: true })))
      .finally(() => {
        inFlight.current = false;
        setAnswering(false);
      });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave review" onPress={finish} hitSlop={12}>
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
        <QuestionCard
          question={item.question}
          recall
          attempts={itemAttempts}
          sourceCards={sourceCards}
          busy={answering}
          onSelect={onSelect}
        />
        {unreachable[item.question.id] && <Body muted>Couldn’t check that one. It’ll come back next time.</Body>}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={resolved ? (index === queue.length - 1 ? 'Finish review' : 'Continue') : itemAttempts.length > 0 ? 'Choose again' : 'Choose an answer'}
          disabled={!resolved}
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
