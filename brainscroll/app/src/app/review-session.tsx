import { REVIEW_SESSION_MAX_QUESTIONS, XP, type BrainpowerEarned as Earned, type Card, type DailyAllowance, type ReviewItem } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrainpowerEarned } from '@/components/BrainpowerEarned';
import { BrainpowerFlight, NO_DAILY } from '@/components/BrainpowerFlight';
import { DrScrollTip } from '@/components/DrScrollTip';
import { canCheck, feedbackTone, QuestionCard, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { Body, Button, Caption, DrScroll, Eyebrow, H2, LessonShell, LessonSkeleton, LoadError, Notice, Numeral, Pop, Reveal, StateBlock, useCountUp } from '@/components/ui';
import { getCard, getSkill } from '@/content';
import { TrophyEarned } from '@/components/TrophyEarned';
import { useProgress, type AttemptView } from '@/progress/ProgressProvider';
import { useNewTrophies } from '@/progress/useNewTrophies';
import { feedback } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';

/**
 * A short recall session in the same lesson shell and question language as a
 * level: up to REVIEW_SESSION_MAX_QUESTIONS due concepts, one question each.
 * The first CHECK is recorded (+10 XP if right, once per scheduled review); a
 * miss shows the question's source cards beneath it and the choices stay open
 * until the right answer is chosen. The answer is never simply revealed,
 * corrections earn nothing, and nothing is ever taken away.
 */
export default function ReviewSessionScreen() {
  const p = useProgress();
  // The queue is fixed for the session so items don't reshuffle as they're answered.
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | undefined>();
  // Every graded attempt per review question, as the server judged it.
  const [attempts, setAttempts] = useState<Record<string, AttemptView[]>>({});
  // Items the server couldn't be reached for: let them move on; they stay due.
  const [unreachable, setUnreachable] = useState<Record<string, boolean>>({});
  const [answering, setAnswering] = useState(false);
  const [xp, setXp] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  // Brainpower this session earned (each answer reports its own), and the balance after the last.
  const [earned, setEarned] = useState<Earned[]>([]);
  const [daily, setDaily] = useState<DailyAllowance | null>(null);

  // Bumped by "Try again".
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!p.ready) return;
    p.reviewQueue(REVIEW_SESSION_MAX_QUESTIONS).then(
      (q) => {
        setFailed(false);
        setQueue(q);
      },
      () => setFailed(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ready, attempt]);

  // Opened with no history behind it (a deep link, a refresh): back means the Review tab.
  const back = () => (router.canGoBack() ? router.back() : router.replace('/review'));
  // Refresh Home/Review counts once the session is over.
  const finish = () => {
    void p.refresh();
    back();
  };

  if (failed)
    return (
      <LoadError
        layout="screen"
        onRetry={() => {
          setFailed(false);
          setAttempt((a) => a + 1);
        }}
        onBack={back}
      />
    );
  if (queue === null) return <LessonSkeleton label="Loading your review" />;
  if (queue.length === 0)
    return (
      <StateBlock
        layout="screen"
        spot="review.empty"
        art="review-clear"
        title="You’re caught up."
        body="Nothing needs review right now. Go learn something new."
        secondary={{ label: 'Back', onPress: back }}
      />
    );
  if (index >= queue.length)
    return <ReviewComplete xp={xp} firstTry={firstTry} total={queue.length} daily={daily ? { ...daily, brainpowerEarned: earned } : NO_DAILY} onDone={finish} />;

  const item = queue[index]!;
  const itemAttempts = attempts[item.question.id] ?? [];
  const resolved = questionStatus(itemAttempts).resolved || !!unreachable[item.question.id];
  const sourceCards = item.question.sourceCardIds.map(getCard).filter((c): c is Card => !!c);
  const isLast = index === queue.length - 1;

  const onCheck = () => {
    const optionId = selected;
    if (!canCheck(itemAttempts, optionId) || resolved || inFlight.current) return;
    inFlight.current = true;
    setAnswering(true);
    const qid = item.question.id;
    p.submitReview(item, optionId)
      .then((r) => {
        setAttempts((m) => ({ ...m, [qid]: [...(m[qid] ?? []), { optionId, correct: r.correct, rationale: r.rationale, wrong: r.wrong, explanation: r.explanation }] }));
        setXp((x) => x + r.xpAwarded);
        setSelected(undefined);
        if (r.correct && r.attemptCount <= 1) setFirstTry((c) => c + 1);
        const d = r.daily;
        if (d) {
          setDaily(d);
          setEarned((e) => [...e, ...d.brainpowerEarned.filter((x) => !e.some((y) => y.key === x.key))]);
        }
        if (r.correct) feedback('correct');
        else feedback('incorrect');
      })
      .catch(() => setUnreachable((m) => ({ ...m, [qid]: true })))
      .finally(() => {
        inFlight.current = false;
        setAnswering(false);
      });
  };

  return (
    <LessonShell
      progress={(index + (resolved ? 1 : 0)) / queue.length}
      onClose={finish}
      closeLabel="Leave review"
      scrollRef={scrollRef}
      contentKey={item.question.id}
      footerTone={feedbackTone(itemAttempts)}
      feedback={
        itemAttempts.length > 0 || unreachable[item.question.id] ? (
          <>
            <QuestionFeedback attempts={itemAttempts} />
            {unreachable[item.question.id] && <Notice tone="muted">Couldn’t check that one. It’ll come back next time.</Notice>}
          </>
        ) : null
      }
      footer={
        <>
          {resolved ? (
            <Button
              variant="success"
              label={isLast ? 'Finish review' : 'Continue'}
              onPress={() => {
                setSelected(undefined);
                setIndex(index + 1);
              }}
            />
          ) : (
            <Button label={answering ? 'Checking' : 'Check'} loading={answering} disabled={!canCheck(itemAttempts, selected)} onPress={onCheck} />
          )}
        </>
      }>
      <DrScrollTip key="review" tip="first-review" when={index === 0} />
      <Caption>
        {getSkill(item.skillId)?.name} · {index + 1} of {queue.length}
      </Caption>
      <QuestionCard
        question={item.question}
        recall
        attempts={itemAttempts}
        selected={selected}
        sourceCards={sourceCards}
        busy={answering}
        onSelect={(opt) => {
          feedback('select');
          setSelected(opt);
        }}
      />
    </LessonShell>
  );
}

/** A modest progression moment: review XP is small by design, so the celebration is too. */
function ReviewComplete({ xp, firstTry, total, daily, onDone }: { xp: number; firstTry: number; total: number; daily: DailyAllowance; onDone: () => void }) {
  const shown = useCountUp(xp, { delay: 200 });
  // A review can earn a trophy too (a streak day, Long Memory): celebrate it here, once.
  const newTrophies = useNewTrophies('review-session');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep, padding: layout.gutter }}>
      <BrainpowerFlight daily={daily}>
      {/* Scrolls on small phones when a trophy card joins the XP. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.lg, alignItems: 'center', paddingVertical: space.lg }}>
        <DrScroll spot="review-complete" size="md" />
        <Eyebrow tone="success">Review complete</Eyebrow>
        <Pop>
          <Numeral size="hero" tone="brand" accessibilityLabel={`plus ${xp} XP`}>
            +{shown} XP
          </Numeral>
        </Pop>
        <Reveal delay={300}>
          <H2 center>
            {firstTry} / {total} right first time
          </H2>
        </Reveal>
        <Reveal delay={450}>
          <Body muted center>
            {xp < firstTry * XP.REVIEW_FIRST_ATTEMPT
              ? `+${XP.REVIEW_FIRST_ATTEMPT} XP for each one you remembered after a break. A quick re-check of one you just missed, or just saw in a lesson, earns no XP, but it still helps it stick.`
              : `+${XP.REVIEW_FIRST_ATTEMPT} XP for each one you remembered on the first try.`}
          </Body>
        </Reveal>
        {daily.brainpowerEarned.length > 0 && (
          <View style={{ alignSelf: 'stretch' }}>
            <Reveal delay={500}>
              <BrainpowerEarned daily={daily} at={500} />
            </Reveal>
          </View>
        )}
        {newTrophies.length > 0 && (
          <View style={{ alignSelf: 'stretch' }}>
            <Reveal delay={550}>
              <TrophyEarned trophies={newTrophies} at={550} />
            </Reveal>
          </View>
        )}
      </ScrollView>
      <Button label="Done" onPress={onDone} />
      </BrainpowerFlight>
    </SafeAreaView>
  );
}
