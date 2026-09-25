import { CompletionError, LEARNING_STRUCTURE, type Level, type MascotSpot, type StartReason } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { DrScrollTip } from '@/components/DrScrollTip';
import { feedbackTone, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { ReportSheet } from '@/components/ReportSheet';
import { Body, Button, Caption, DrScroll, DrScrollLoading, H1, H2, IconButton, LessonShell, LevelArt, Row } from '@/components/ui';
import { getCard, getSkill } from '@/content';
import { useProgress, type LevelSession } from '@/progress/ProgressProvider';
import { haptic } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';

/**
 * The level player: a finite, authored sequence of cards with a visible end,
 * in the quiet lesson shell. One card per screen, one obvious action at the
 * bottom. Position and answers are saved on every step so an interrupted level
 * resumes exactly.
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
  const [selected, setSelected] = useState<string | undefined>();
  const [reporting, setReporting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inFlight = useRef(false);
  const answerInFlight = useRef(false);
  // Where a learner leaves an unfinished level (content health: which card loses people).
  const exitRef = useRef<{ levelId: string; cardIndex: number; cardCount: number; done: boolean } | null>(null);
  useEffect(
    () => () => {
      const x = exitRef.current;
      if (x && !x.done) track('level_exit', { level_id: x.levelId, card_index: x.cardIndex, card_count: x.cardCount });
    },
    [],
  );
  const cardIndex = session?.cardIndex;
  useEffect(() => {
    if (level && cardIndex !== undefined)
      exitRef.current = { levelId: level.id, cardIndex, cardCount: level.cards.length, done: exitRef.current?.done ?? false };
  }, [level, cardIndex]);

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

  if (blocked === 'LEVEL_NOT_AVAILABLE') return <Message spot="not-found" title="This level doesn't exist." />;
  if (blocked === 'LEVEL_LOCKED') return <Message spot="level.locked" title="Not unlocked yet." body="Clear the levels before this one first." />;
  if (error && !session) return <Message spot="error.load" title="Something went wrong." body={error} />;
  if (!level || !session)
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center' }}>
        <DrScrollLoading />
      </View>
    );

  const skill = getSkill(level.skillId);
  const card = level.cards[session.cardIndex]!;
  const isLast = session.cardIndex === level.cards.length - 1;
  const questionId = card.type === 'mcq' || card.type === 'recall' ? card.questionId : undefined;
  const attempts = questionId ? (session.attempts[questionId] ?? []) : [];
  const status = questionStatus(attempts);
  // A question blocks progress until it's answered correctly (on any attempt).
  const unresolved = questionId !== undefined && !status.resolved;
  // Evidence cards: this level's cards first, then earlier levels in the offline bundle.
  const resolveCard = (cardId: string) => level.cards.find((c) => c.id === cardId) ?? getCard(cardId);
  const typeLabel = LEARNING_STRUCTURE[level.type].label;
  const context = level.type === 'regular' ? `${skill?.name ?? ''} · Level ${level.number}` : `${skill?.name ?? ''} · ${typeLabel} ${level.number}`;

  const update = (patch: Partial<LevelSession>) => {
    const next = { ...session, ...patch };
    setSession(next);
    p.updateSession(level.id, patch);
  };

  const onCheck = () => {
    const qid = questionId;
    const optionId = selected;
    if (!qid || !optionId || answerInFlight.current || status.resolved || attempts.some((a) => a.optionId === optionId)) return;
    answerInFlight.current = true;
    setAnswering(true);
    setError(null);
    p.answerQuestion(level, qid, optionId)
      .then((r) => {
        const attempt = { optionId, correct: r.correct, rationale: r.rationale, explanation: r.explanation };
        setSession((s) => (s ? { ...s, attempts: { ...s.attempts, [qid]: [...(s.attempts[qid] ?? []), attempt] } } : s));
        setSelected(undefined);
        if (r.correct) haptic.correct();
        else {
          haptic.incorrect();
          // The evidence appears right under the prompt: bring it into view.
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      })
      .catch(() => setError("Couldn't check that answer. Try again."))
      .finally(() => {
        answerInFlight.current = false;
        setAnswering(false);
      });
  };

  const onContinue = () => {
    if (!isLast) {
      setSelected(undefined);
      update({ cardIndex: session.cardIndex + 1 });
      return;
    }
    if (inFlight.current) return; // double-tap guard; completion is idempotent server-side too
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    p.completeLevel(level.id, level)
      .then(() => {
        if (exitRef.current) exitRef.current.done = true;
        haptic.reward();
        router.replace('/level-complete');
      })
      .catch((e) => {
        inFlight.current = false;
        setSubmitting(false);
        if (e instanceof CompletionError && e.code === 'DAILY_LIMIT_REACHED') router.replace('/daily-complete');
        else setError("Couldn't save your progress. Your answers are kept, so try again.");
      });
  };

  const footer = (
    <>
      {questionId && <QuestionFeedback attempts={attempts} />}
      {error && <Body tone="danger">{error}</Body>}
      {unresolved ? (
        <Button label={answering ? 'Checking…' : 'Check'} disabled={!selected || answering} onPress={onCheck} />
      ) : (
        <Button
          variant={questionId ? 'success' : 'primary'}
          label={submitting ? 'Saving…' : isLast ? 'Complete level' : 'Continue'}
          disabled={submitting}
          onPress={onContinue}
        />
      )}
    </>
  );

  return (
    <>
      <LessonShell
        progress={(session.cardIndex + (unresolved ? 0 : 1)) / level.cards.length}
        onClose={() => router.back()}
        closeLabel="Leave level"
        right={<IconButton label="Report a problem" icon="flag" onPress={() => setReporting(true)} />}
        scrollRef={scrollRef}
        contentKey={card.id}
        footer={footer}
        footerTone={questionId ? feedbackTone(attempts) : undefined}>
        {session.cardIndex === 0 && (
          <View style={{ gap: space.sm, marginBottom: space.lg }}>
            <LevelArt art={level.art} size={168} style={{ alignSelf: 'center', marginBottom: space.sm }} />
            {level.type === 'checkpoint' ? (
              <Row gap={space.sm}>
                <DrScroll spot="checkpoint.intro" size="xs" />
                <Caption tone="brand">{context}</Caption>
              </Row>
            ) : (
              <Caption tone="brand">{context}</Caption>
            )}
            <H1>{level.title}</H1>
            <Caption>{level.objective}</Caption>
          </View>
        )}
        {level.type === 'checkpoint' && session.cardIndex === 0 && <DrScrollTip key="checkpoint" tip="first-checkpoint" />}
        {questionId && <DrScrollTip key={`question-${card.id}`} tip="first-question" when={attempts.length === 0} />}
        {questionId && <DrScrollTip key={`miss-${card.id}`} tip="first-miss" when={status.needsAnotherLook} />}
        <CardRenderer
          card={card}
          level={level}
          attempts={attempts}
          selected={selected}
          busy={answering}
          resolveCard={resolveCard}
          onSelect={(opt) => {
            haptic.select();
            setSelected(opt);
          }}
        />
      </LessonShell>
      {reporting && (
        <ReportSheet
          target={{ levelId: level.id, revision: session.revision, objectType: questionId ? 'question' : 'card', objectId: questionId ?? card.id }}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  );
}

function Message({ spot, title, body }: { spot: MascotSpot; title: string; body?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, padding: layout.gutter, gap: space.lg, justifyContent: 'center' }}>
      <DrScroll spot={spot} size="md" />
      <H2>{title}</H2>
      {body && <Body muted>{body}</Body>}
      <Button variant="secondary" label="Back" onPress={() => router.back()} />
    </SafeAreaView>
  );
}
