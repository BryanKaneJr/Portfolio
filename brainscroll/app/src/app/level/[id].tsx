import { cardPicturePose, CompletionError, LEARNING_STRUCTURE, type Level, type StartReason } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { DrScrollTip } from '@/components/DrScrollTip';
import { feedbackTone, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { ReportSheet } from '@/components/ReportSheet';
import { Button, Caption, DrScroll, H1, hasLevelArt, IconButton, LessonShell, LessonSkeleton, LevelArt, LoadError, Notice, Row, StateBlock } from '@/components/ui';
import { getCard, getSkill, skills } from '@/content';
import { CARD_ART } from '@/content/cardArt';
import { skillTint } from '@/theme/subjectTheme';
import { useProgress, type LevelSession } from '@/progress/ProgressProvider';
import { feedback } from '@/theme/feedback';
import { layout, space } from '@/theme/tokens';

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
  // Bumped by "Try again" after a failed load.
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
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
  const sessionCard = session?.cardIndex;
  useEffect(() => {
    if (level && sessionCard !== undefined)
      exitRef.current = { levelId: level.id, cardIndex: sessionCard, cardCount: level.cards.length, done: exitRef.current?.done ?? false };
  }, [level, sessionCard]);

  useEffect(() => {
    if (!p.ready) return;
    let cancelled = false;
    // Eligibility and content come from the backend once, on entry.
    p.startLevel(id)
      .then((r) => {
        if (cancelled) return;
        if (r.reason === 'DAILY_COMPLETE') router.replace('/daily-complete');
        else if ((r.reason === 'NEW' || r.reason === 'REPLAY') && r.level) {
          setLevel(playable(r.level));
          setSession(p.getSession(r.level.id, r.revision ?? r.level.revision));
        } else setBlocked(r.reason);
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ready, id, attempt]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (blocked === 'LEVEL_NOT_AVAILABLE')
    return <StateBlock layout="screen" spot="not-found" title="This level doesn’t exist." body="It may have moved. Your progress is safe." secondary={{ label: 'Back', onPress: back }} />;
  if (blocked === 'LEVEL_LOCKED')
    return <StateBlock layout="screen" spot="level.locked" eyebrow="Locked" title="Not unlocked yet." body="Clear the levels before this one first." secondary={{ label: 'Back', onPress: back }} />;
  if (loadFailed && !session)
    return (
      <LoadError
        layout="screen"
        onRetry={() => {
          setLoadFailed(false);
          setAttempt((a) => a + 1);
        }}
        onBack={back}
      />
    );
  if (!level || !session) return <LessonSkeleton />;

  const skill = getSkill(level.skillId);
  const cardIndex = Math.min(session.cardIndex, level.cards.length - 1);
  const card = level.cards[cardIndex]!;
  const isLast = cardIndex === level.cards.length - 1;
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
        if (r.correct) feedback('correct');
        else feedback('incorrect');
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
      update({ cardIndex: cardIndex + 1 });
      return;
    }
    if (inFlight.current) return; // double-tap guard; completion is idempotent server-side too
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    p.completeLevel(level.id, level)
      .then(() => {
        if (exitRef.current) exitRef.current.done = true;
        router.replace('/level-complete');
      })
      .catch((e) => {
        inFlight.current = false;
        setSubmitting(false);
        if (e instanceof CompletionError && e.code === 'DAILY_LIMIT_REACHED') router.replace('/daily-complete');
        else setError("Couldn't save your progress. Your answers are kept, so try again.");
      });
  };

  const verdict = questionId !== undefined && attempts.length > 0;
  const feedbackArea =
    verdict || error ? (
      <>
        {verdict && <QuestionFeedback attempts={attempts} />}
        {error && <Notice>{error}</Notice>}
      </>
    ) : null;
  const footer = (
    <>
      {unresolved ? (
        <Button label={answering ? 'Checking' : 'Check'} loading={answering} disabled={!selected} onPress={onCheck} />
      ) : (
        <Button
          variant={questionId ? 'success' : 'primary'}
          label={submitting ? 'Saving' : isLast ? 'Complete level' : 'Continue'}
          loading={submitting}
          onPress={onContinue}
        />
      )}
    </>
  );

  return (
    <>
      {/* While the report sheet is open, screen readers stay inside it. */}
      <View style={{ flex: 1 }} aria-hidden={reporting}>
        <LessonShell
          progress={(cardIndex + (unresolved ? 0 : 1)) / level.cards.length}
          onClose={() => router.back()}
          closeLabel="Leave level"
          right={<IconButton label="Report a problem" icon="flag" onPress={() => setReporting(true)} />}
          scrollRef={scrollRef}
          contentKey={card.id}
          barFill={skillTint(level.skillId, skills).base}
          feedback={feedbackArea}
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
          <RoomyArt picture={!questionId && session.cardIndex > 0 ? cardPicture(level, card, session.cardIndex) : undefined}>
            <CardRenderer
              card={card}
              level={level}
              attempts={attempts}
              selected={selected}
              busy={answering}
              resolveCard={resolveCard}
              onSelect={(opt) => {
                feedback('select');
                setSelected(opt);
              }}
            />
          </RoomyArt>
        </LessonShell>
      </View>
      {reporting && (
        <ReportSheet
          target={{ levelId: level.id, revision: session.revision, objectType: questionId ? 'question' : 'card', objectId: questionId ?? card.id }}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  );
}

/**
 * What sits above a learning card: its own illustration (content/card-art.json,
 * so a Jupiter card shows Jupiter, not the level's Saturn), or Dr. Scroll when
 * it has none, taking turns between his skill costume and calm poses. A card
 * with his aside already has him, so it gets no second Dr. Scroll.
 */
type CardPicture = { art: string } | { pose: ReturnType<typeof cardPicturePose> };
function cardPicture(level: Level, card: Level['cards'][number], cardIndex: number): CardPicture | undefined {
  const art = CARD_ART[card.id];
  if (art && hasLevelArt(art)) return { art };
  return 'mascot' in card && card.mascot ? undefined : { pose: cardPicturePose(level.skillId, level.number, cardIndex) };
}

/**
 * Large phones leave a short card floating over a lot of empty screen. When a
 * learning card fits with room to spare, its picture sits above it, sized to
 * the room (never on questions: what's under a question would give answers
 * away, and art there would only push the choices down). A card that fills
 * the screen, or a small phone, shows none. The card is hidden until its
 * first measure so the text never jumps, and re-measured if it reflows
 * (rotation, a resized window). The picture sits outside the measured card,
 * so showing it can't change the measure.
 */
function RoomyArt({ picture, children }: { picture?: CardPicture; children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [cardHeight, setCardHeight] = useState<number>();
  if (!picture) return <>{children}</>;
  // The lesson column's room: the screen less the top bar, one-button footer and scroll padding.
  const footer = space.lg + layout.buttonHeight + Math.max(insets.bottom, space.lg);
  const room = height - insets.top - layout.topBarHeight - footer - space.xl - space.xxl;
  const size = cardHeight === undefined ? 0 : Math.min(ROOMY_ART_MAX, room - cardHeight - space.lg);
  return (
    <View style={{ gap: space.lg, opacity: cardHeight === undefined ? 0 : 1 }}>
      {size >= ROOMY_ART_MIN &&
        ('art' in picture ? (
          <LevelArt art={picture.art} size={size} style={{ alignSelf: 'center' }} />
        ) : (
          // He stands a little smaller than an illustration, so he reads as company, not content.
          <DrScroll spot="lesson.card-picture" pose={picture.pose} size={Math.round(size * 0.8)} style={{ alignSelf: 'center' }} />
        ))}
      <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>{children}</View>
    </View>
  );
}
const ROOMY_ART_MIN = 120;
const ROOMY_ART_MAX = 200;

/**
 * A checkpoint's (or milestone's, or mastery challenge's) recap card isn't
 * played in the lesson: it becomes the proof on Level Complete ("10 levels
 * ago, could you have explained this?"), so it isn't shown twice in a row.
 */
function playable(level: Level): Level {
  return level.type === 'regular' ? level : { ...level, cards: level.cards.filter((c) => c.type !== 'checkpoint') };
}
