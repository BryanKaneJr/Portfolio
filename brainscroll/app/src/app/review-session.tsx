import { REVIEW_SESSION_MAX_QUESTIONS, XP, type Card, type ReviewItem } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrScrollTip } from '@/components/DrScrollTip';
import { feedbackTone, QuestionCard, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { Body, Button, Caption, DrScroll, Eyebrow, H2, LessonShell, Numeral, Pop, Reveal, useCountUp } from '@/components/ui';
import { getCard, getConcept, getSkill } from '@/content';
import { useProgress, type AttemptView } from '@/progress/ProgressProvider';
import { haptic } from '@/theme/feedback';
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

  if (failed) return <Message title="Couldn’t load your review." body="Check your connection and try again." />;
  if (queue === null) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  if (queue.length === 0) return <Message title="Nothing due right now." body="Go learn something new, or go outside. Both count." />;
  if (index >= queue.length) return <ReviewComplete xp={xp} firstTry={firstTry} total={queue.length} onDone={finish} />;

  const item = queue[index]!;
  const itemAttempts = attempts[item.question.id] ?? [];
  const resolved = questionStatus(itemAttempts).resolved || !!unreachable[item.question.id];
  const concept = getConcept(item.conceptId);
  const sourceCards = item.question.sourceCardIds.map(getCard).filter((c): c is Card => !!c);
  const isLast = index === queue.length - 1;

  const onCheck = () => {
    const optionId = selected;
    if (!optionId || resolved || inFlight.current) return;
    inFlight.current = true;
    setAnswering(true);
    const qid = item.question.id;
    p.submitReview(item, optionId)
      .then((r) => {
        setAttempts((m) => ({ ...m, [qid]: [...(m[qid] ?? []), { optionId, correct: r.correct, rationale: r.rationale, explanation: r.explanation }] }));
        setXp((x) => x + r.xpAwarded);
        setSelected(undefined);
        if (r.correct && r.attemptCount <= 1) setFirstTry((c) => c + 1);
        if (r.correct) haptic.correct();
        else {
          haptic.incorrect();
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
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
      footer={
        <>
          <QuestionFeedback attempts={itemAttempts} />
          {unreachable[item.question.id] && <Body muted>Couldn’t check that one. It’ll come back next time.</Body>}
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
            <Button label={answering ? 'Checking…' : 'Check'} disabled={!selected || answering} onPress={onCheck} />
          )}
        </>
      }>
      <DrScrollTip key="review" tip="first-review" when={index === 0} />
      <Caption>
        Review · {getSkill(item.skillId)?.name} · {index + 1} of {queue.length}
        {concept ? ` · ${concept.title}` : ''}
      </Caption>
      <QuestionCard
        question={item.question}
        recall
        attempts={itemAttempts}
        selected={selected}
        sourceCards={sourceCards}
        busy={answering}
        onSelect={(opt) => {
          haptic.select();
          setSelected(opt);
        }}
      />
    </LessonShell>
  );
}

/** A modest progression moment: review XP is small by design, so the celebration is too. */
function ReviewComplete({ xp, firstTry, total, onDone }: { xp: number; firstTry: number; total: number; onDone: () => void }) {
  const shown = useCountUp(xp, { delay: 200 });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep, padding: layout.gutter }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg, alignItems: 'center' }}>
        <DrScroll spot="review-complete" size="md" />
        <Eyebrow tone="success">Review complete</Eyebrow>
        <Pop>
          <Numeral size="hero" tone="brand">
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
            {firstTry === total
              ? `+${XP.REVIEW_FIRST_ATTEMPT} XP for each one you remembered on the first try.`
              : `+${XP.REVIEW_FIRST_ATTEMPT} XP for each one you remembered on the first try. The ones you corrected will come back sooner.`}
          </Body>
        </Reveal>
      </View>
      <Button label="Done" onPress={onDone} />
    </SafeAreaView>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, padding: layout.gutter, gap: space.lg, justifyContent: 'center' }}>
      <H2>{title}</H2>
      <Body muted>{body}</Body>
      <Button variant="secondary" label="Back" onPress={() => router.back()} />
    </SafeAreaView>
  );
}
