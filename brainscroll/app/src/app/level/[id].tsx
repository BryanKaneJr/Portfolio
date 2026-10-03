import { cardPicturePose, CompletionError, DR_SCROLL_LINES, mascotPictureCard, LEARNING_STRUCTURE, type Level, type StartReason } from '@brainscroll/core';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { DrScrollTip } from '@/components/DrScrollTip';
import { feedbackTone, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { ReportSheet } from '@/components/ReportSheet';
import { Button, Caption, Card, DrScroll, DrScrollSays, H1, hasLevelArt, IconButton, LessonShell, LessonSkeleton, LevelArt, LoadError, Notice, Row, StateBlock } from '@/components/ui';
import { getCard, getSkill, skills } from '@/content';
import { CARD_ART, CARD_ART_FILL } from '@/content/cardArt';
import { skillTint } from '@/theme/subjectTheme';
import { useProgress, type LevelSession } from '@/progress/ProgressProvider';
import { feedback } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';

/**
 * The level player: a finite, authored sequence of cards with a visible end,
 * in the quiet lesson shell. One card per screen, one obvious action at the
 * bottom. A level never resumes (owner, 2026-10-02): leaving partway forgets
 * where you were, so it starts from the first card next time, and Dr. Scroll
 * checks first ("If you leave now, this level starts over"). What a level pays
 * is unaffected: first attempts are recorded server-side when checked.
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
  const progressRef = useRef(p);
  useEffect(() => {
    progressRef.current = p;
  });
  useEffect(
    () => () => {
      const x = exitRef.current;
      if (x && !x.done) {
        track('level_exit', { level_id: x.levelId, card_index: x.cardIndex, card_count: x.cardCount });
        // However the level was left (close, back, another tab), it starts over next time.
        progressRef.current.discardSession(x.levelId);
      }
    },
    [],
  );
  // Leaving partway asks first. `leaving` is set once the way out is settled (confirmed, or the level is done).
  const navigation = useNavigation();
  const leaving = useRef(false);
  const pendingLeave = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const started = !!session && (session.cardIndex > 0 || Object.keys(session.attempts).length > 0);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leaving.current || !started) return;
        e.preventDefault();
        pendingLeave.current = e.data.action;
        setConfirmLeave(true);
      }),
    [navigation, started],
  );
  const leaveNow = () => {
    leaving.current = true;
    setConfirmLeave(false);
    if (pendingLeave.current) navigation.dispatch(pendingLeave.current);
  };
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
          setSession(p.startSession(r.level.id, r.revision ?? r.level.revision));
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
        const attempt = { optionId, correct: r.correct, rationale: r.rationale, wrong: r.wrong, explanation: r.explanation };
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
        leaving.current = true;
        router.replace('/level-complete');
      })
      .catch((e) => {
        inFlight.current = false;
        setSubmitting(false);
        // The learner sees a plain message; development builds say what actually went wrong (Metro terminal).
        if (__DEV__) console.warn(`[level] couldn't complete ${level.id}:`, e instanceof Error ? e.message : e);
        if (e instanceof CompletionError && e.code === 'DAILY_LIMIT_REACHED') {
          leaving.current = true;
          router.replace('/daily-complete');
        }
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
      <View style={{ flex: 1 }} aria-hidden={reporting || confirmLeave}>
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
      {confirmLeave && <LeaveSheet onStay={() => setConfirmLeave(false)} onLeave={leaveNow} />}
    </>
  );
}

/** Dr. Scroll checks before a level is left partway: it starts over next time. A modal, like the report sheet. */
function LeaveSheet({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <View style={styles.overlay} accessibilityViewIsModal aria-modal>
      <Card variant="raised" style={{ width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.md }}>
        <DrScrollSays spot="lesson.leave" lines={[DR_SCROLL_LINES.leaveLevel]} />
        <Button label="Keep going" onPress={onStay} />
        <Button variant="secondary" label="Leave anyway" onPress={onLeave} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim, justifyContent: 'flex-end', padding: space.lg },
});

/**
 * What sits above a learning card: its own illustration (content/card-art.json,
 * so a Jupiter card shows Jupiter, not the level's Saturn), or Dr. Scroll when
 * it has none, taking turns between his skill costume and calm poses. A card
 * with his aside already has him, so it gets no second Dr. Scroll.
 */
type CardPicture = { art: string } | { pose: ReturnType<typeof cardPicturePose>; instead?: string };
const usable = (art?: string) => (art && hasLevelArt(art) ? art : undefined);
/** A card's reviewed illustration (content/card-art.json). */
const ownArt = (card: Level['cards'][number]) => usable(CARD_ART[card.id]);
/**
 * A learning card's picture (owner, 2026-10-03: every card gets one): its
 * reviewed illustration; else, on at most one card a level, Dr. Scroll (core
 * mascotPictureCard: about one learning card in ten); else the generated fill
 * (a loose match among the skill's images, or the level's or its chapter's).
 */
function cardPicture(level: Level, card: Level['cards'][number], cardIndex: number): CardPicture | undefined {
  const art = ownArt(card);
  if (art) return { art };
  const hasAside = level.cards.some((c) => 'mascot' in c && !!c.mascot);
  const candidates = level.cards.flatMap((c, i) => (i > 0 && !('questionId' in c) && !ownArt(c) ? [i] : []));
  const filled = usable(CARD_ART_FILL[card.id]);
  // Dr. Scroll needs room; without it, the card keeps its filled picture.
  if (mascotPictureCard(level.skillId, level.number, candidates, hasAside) === cardIndex) return { pose: cardPicturePose(level.skillId, level.number, cardIndex), instead: filled };
  return filled ? { art: filled } : undefined;
}

/**
 * A learning card's picture sits above it, sized to the room the card leaves
 * (never on questions: what's under a question would give answers away, and
 * art there would only push the choices down). A card's own illustration
 * always shows, at least OWN_ART_MIN (the card scrolls if it must: owner,
 * 2026-10-03, the pictures went missing once lessons got bigger text); Dr.
 * Scroll as a guest picture only shows when there's room for him. The card is hidden until its
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
      {'art' in picture ? (
        cardHeight !== undefined && <LevelArt art={picture.art} size={Math.max(size, OWN_ART_MIN)} style={{ alignSelf: 'center' }} />
      ) : (
        size >= ROOMY_ART_MIN ? (
          // He stands a little smaller than an illustration, so he reads as company, not content.
          <DrScroll spot="lesson.card-picture" pose={picture.pose} size={Math.round(size * 0.8)} style={{ alignSelf: 'center' }} />
        ) : (
          cardHeight !== undefined && picture.instead && <LevelArt art={picture.instead} size={Math.max(size, OWN_ART_MIN)} style={{ alignSelf: 'center' }} />
        )
      )}
      <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>{children}</View>
    </View>
  );
}
const ROOMY_ART_MIN = 120;
/** A card's own illustration never shrinks below this, and always shows. */
const OWN_ART_MIN = 96;
const ROOMY_ART_MAX = 200;

/**
 * A checkpoint's (or milestone's, or mastery challenge's) recap card isn't
 * played in the lesson: it becomes the proof on Level Complete ("10 levels
 * ago, could you have explained this?"), so it isn't shown twice in a row.
 */
function playable(level: Level): Level {
  return level.type === 'regular' ? level : { ...level, cards: level.cards.filter((c) => c.type !== 'checkpoint') };
}
