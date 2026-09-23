import { CompletionError, LEARNING_STRUCTURE, type Level, type StartReason } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { Body, Button, Label, ProgressBar, Title } from '@/components/ui';
import { getCard, getSkill } from '@/content';
import { useProgress, type LevelSession } from '@/progress/ProgressProvider';
import { color, space } from '@/theme/tokens';

/**
 * The level player: a finite, authored sequence of cards with a visible end.
 * Position and answers are saved on every step so an interrupted level resumes.
 */
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const [level, setLevel] = useState<Level | null>(null);
  const [session, setSession] = useState<LevelSession | null>(null);
  const [blocked, setBlocked] = useState<StartReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const inFlight = useRef(false);
  const answerInFlight = useRef(false);

  useEffect(() => {
    if (!p.ready) return;
    let cancelled = false;
    // Eligibility and content come from the backend once, on entry.
    p.startLevel(id)
      .then((r) => {
        if (cancelled) return;
        if (r.reason === 'DAILY_COMPLETE') router.replace('/daily-complete');
        else if ((r.reason === 'NEW' || r.reason === 'REPLAY') && r.level) {
          setLevel(r.level);
          setSession(p.getSession(r.level.id, r.revision ?? r.level.revision));
        } else setBlocked(r.reason);
      })
      .catch(() => !cancelled && setError("Couldn't load this level. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ready, id]);

  if (blocked === 'LEVEL_NOT_AVAILABLE') return <Message title="This level doesn't exist." />;
  if (blocked === 'LEVEL_LOCKED') return <Message title="Not unlocked yet." body="Clear the levels before this one first." />;
  if (error && !session) return <Message title="Something went wrong." body={error} />;
  if (!level || !session) return <View style={styles.screen} />;

  const skill = getSkill(level.skillId);
  const card = level.cards[session.cardIndex]!;
  const isLast = session.cardIndex === level.cards.length - 1;
  const questionId = card.type === 'mcq' || card.type === 'recall' ? card.questionId : undefined;
  const attempts = questionId ? (session.attempts[questionId] ?? []) : [];
  // A question blocks progress until it's answered correctly (on any attempt).
  const unresolved = questionId !== undefined && !attempts.some((a) => a.correct);
  // Evidence cards: this level's cards first, then earlier levels in the offline bundle.
  const resolveCard = (cardId: string) => level.cards.find((c) => c.id === cardId) ?? getCard(cardId);

  const update = (patch: Partial<LevelSession>) => {
    const next = { ...session, ...patch };
    setSession(next);
    p.updateSession(level.id, patch);
  };

  const onAnswer = (qid: string, optionId: string) => {
    const prior = session.attempts[qid] ?? [];
    if (answerInFlight.current || prior.some((a) => a.correct) || prior.some((a) => a.optionId === optionId)) return;
    answerInFlight.current = true;
    setAnswering(true);
    setError(null);
    p.answerQuestion(level, qid, optionId)
      .then((r) => {
        const attempt = { optionId, correct: r.correct, rationale: r.rationale, explanation: r.explanation };
        setSession((s) => (s ? { ...s, attempts: { ...s.attempts, [qid]: [...(s.attempts[qid] ?? []), attempt] } } : s));
      })
      .catch(() => setError("Couldn't check that answer. Try again."))
      .finally(() => {
        answerInFlight.current = false;
        setAnswering(false);
      });
  };

  const onContinue = () => {
    if (!isLast) {
      update({ cardIndex: session.cardIndex + 1 });
      return;
    }
    if (inFlight.current) return; // double-tap guard; completion is idempotent server-side too
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    p.completeLevel(level.id, level)
      .then(() => router.replace('/level-complete'))
      .catch((e) => {
        inFlight.current = false;
        setSubmitting(false);
        if (e instanceof CompletionError && e.code === 'DAILY_LIMIT_REACHED') router.replace('/daily-complete');
        else setError("Couldn't save your progress. Your answers are kept, so try again.");
      });
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
            {level.type !== 'regular' && ` · ${LEARNING_STRUCTURE[level.type].label}`}
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
        <CardRenderer card={card} level={level} attempts={attempts} busy={answering} resolveCard={resolveCard} onAnswer={onAnswer} />
      </ScrollView>

      <View style={styles.footer}>
        {error && <Body muted>{error}</Body>}
        <Button
          label={submitting ? 'Saving…' : isLast ? 'Complete level' : unresolved ? (attempts.length ? 'Choose again' : 'Choose an answer') : 'Continue'}
          disabled={unresolved || submitting || answering}
          onPress={onContinue}
        />
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
