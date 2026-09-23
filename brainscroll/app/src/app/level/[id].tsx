import { CompletionError, type StartReason } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { Body, Button, Label, ProgressBar, Title } from '@/components/ui';
import { getLevel, getSkill } from '@/content';
import { useProgress, type LevelSession } from '@/progress/ProgressProvider';
import { color, space } from '@/theme/tokens';

/**
 * The level player: a finite, authored sequence of cards with a visible end.
 * Position and answers are saved on every step so an interrupted level resumes.
 */
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = getLevel(id);
  const p = useProgress();
  const [session, setSession] = useState<LevelSession | null>(null);
  const [blocked, setBlocked] = useState<StartReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (!p.ready || !level) return;
    const reason = p.checkStart(level.id);
    if (reason === 'DAILY_COMPLETE') router.replace('/daily-complete');
    else if (reason === 'NEW' || reason === 'REPLAY') setSession(p.getSession(level.id));
    else setBlocked(reason);
    // Eligibility is decided once, on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ready, level?.id]);

  if (!level) return <Message title="This level doesn't exist." />;
  if (blocked === 'LEVEL_LOCKED') return <Message title="Not unlocked yet." body="Clear the levels before this one first." />;
  if (!session) return <View style={styles.screen} />;

  const skill = getSkill(level.skillId);
  const card = level.cards[session.cardIndex]!;
  const isLast = session.cardIndex === level.cards.length - 1;
  const questionId = card.type === 'mcq' || card.type === 'recall' ? card.questionId : undefined;
  const needsAnswer = questionId !== undefined && session.answers[questionId] === undefined;

  const update = (patch: Partial<LevelSession>) => {
    const next = { ...session, ...patch };
    setSession(next);
    p.updateSession(level.id, patch);
  };

  const onAnswer = (qid: string, optionId: string) => {
    if (session.answers[qid] !== undefined) return; // answers are final
    update({ answers: { ...session.answers, [qid]: optionId } });
  };

  const onContinue = () => {
    if (!isLast) {
      update({ cardIndex: session.cardIndex + 1 });
      return;
    }
    if (submitting.current) return; // double-tap guard; the engine is idempotent too
    submitting.current = true;
    try {
      p.completeLevel(level.id);
      router.replace('/level-complete');
    } catch (e) {
      submitting.current = false;
      if (e instanceof CompletionError && e.code === 'DAILY_LIMIT_REACHED') router.replace('/daily-complete');
      else setError(e instanceof CompletionError ? e.code : 'Something went wrong. Your answers are saved.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave level" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={{ flex: 1, gap: space.xs }}>
          <Label>
            {skill?.name} · Level {level.number}
          </Label>
          <ProgressBar value={(session.cardIndex + 1) / level.cards.length} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} key={card.id}>
        {session.cardIndex === 0 && (
          <View style={{ gap: space.xs, marginBottom: space.md }}>
            <Title>{level.title}</Title>
            <Body muted>{level.objective}</Body>
          </View>
        )}
        <CardRenderer card={card} level={level} selected={questionId ? session.answers[questionId] : undefined} onAnswer={onAnswer} />
      </ScrollView>

      <View style={styles.footer}>
        {error && <Body muted>{error}</Body>}
        <Button label={isLast ? 'Complete level' : needsAnswer ? 'Choose an answer' : 'Continue'} disabled={needsAnswer} onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <SafeAreaView style={[styles.screen, { padding: space.lg, gap: space.md }]}>
      <Title>{title}</Title>
      {body && <Body muted>{body}</Body>}
      <Button variant="secondary" label="Back" onPress={() => router.back()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  close: { color: color.textMuted, fontSize: 22, fontWeight: '600' },
  body: { padding: space.lg, paddingTop: space.xl, gap: space.lg },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: color.border },
});
