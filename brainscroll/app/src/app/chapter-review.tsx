import { XP, type ChapterReviewResult } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { BrainpowerEarned } from '@/components/BrainpowerEarned';
import { BrainpowerFlight, NO_DAILY } from '@/components/BrainpowerFlight';
import { canCheck, feedbackTone, QuestionCard, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { Body, Button, Caption, DrScroll, Eyebrow, H1, H2, LessonShell, LessonSkeleton, LoadError, Notice, Numeral, Pop, Reveal, CountUp } from '@/components/ui';
import { chaptersFor, getSkill, levelMeta } from '@/content';
import { useCards } from '@/progress/useCards';
import type { ChapterReviewSession } from '@/progress/backend';
import { useProgress, type AttemptView } from '@/progress/ProgressProvider';
import { feedback } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';

/**
 * Going back over a cleared chapter: one question from each of its levels, in
 * the lesson's shell and question language. The first CHECK is recorded; a
 * miss shows the source cards and the choices stay open until it's right.
 * Finishing pays up to XP.CHAPTER_REVIEW_MAX from first tries, and can be
 * repeated. Leaving keeps your place: opening the chapter again resumes.
 */
export default function ChapterReviewScreen() {
  const { skill: skillId, chapter: chapterParam } = useLocalSearchParams<{ skill: string; chapter: string }>();
  const chapter = Number(chapterParam);
  const p = useProgress();
  const [session, setSession] = useState<ChapterReviewSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [load, setLoad] = useState(0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | undefined>();
  const [attempts, setAttempts] = useState<Record<string, AttemptView[]>>({});
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<ChapterReviewResult | null>(null);
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // The current question's evidence, for a miss (server builds fetch it).
  const evidence = useCards(session?.items[index]?.question.sourceCardIds ?? []);

  useEffect(() => {
    if (!skillId || !chapter || !p.ready) return;
    p.startChapterReview(skillId, chapter).then(
      (s) => {
        setFailed(false);
        track('chapter_review_started', { skill_id: skillId, chapter });
        setSession(s);
        // Resuming: straight to the first question not yet answered right.
        const firstOpen = s.items.findIndex((it) => !s.resolved.includes(it.question.id));
        setIndex(firstOpen === -1 ? s.items.length : firstOpen);
      },
      () => setFailed(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, chapter, p.ready, load]);

  const leave = () => (router.canGoBack() ? router.back() : router.navigate('/practice'));
  const skillName = skillId ? (getSkill(skillId)?.name ?? '') : '';
  const chapterTitle = skillId ? chaptersFor(skillId).find((c) => c.number === chapter)?.title : undefined;

  if (failed || !skillId || !chapter) return <LoadError layout="screen" onRetry={() => setLoad((n) => n + 1)} onBack={leave} />;
  if (session === null) return <LessonSkeleton label="Loading the chapter" />;
  if (result) return <ChapterReviewComplete skillName={skillName} chapter={chapter} chapterTitle={chapterTitle} result={result} onDone={leave} />;

  const items = session.items;
  const n = items.length;

  const finish = () => {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    p.completeChapterReview(session.reviewId)
      .then((r) => {
        feedback('levelComplete');
        if (!r.alreadyCompleted) track('chapter_review_completed', { skill_id: r.skillId, chapter: r.chapter, quest_credit: r.questCredit });
        setResult(r);
      })
      .catch(() => setError('Couldn’t finish the review. Your answers are kept, so try again.'))
      .finally(() => setFinishing(false));
  };

  // Every question resolved (now or on an earlier visit), or finishing failed: finish here.
  if (index >= n)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep, padding: layout.gutter }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg }}>
          <DrScroll spot="review-complete" size="md" />
          <Eyebrow tone="success">Chapter {chapter}</Eyebrow>
          <H1 center>All {n} answered.</H1>
          {error && <Notice>{error}</Notice>}
        </View>
        <Button label={finishing ? 'Finishing' : 'Finish the review'} loading={finishing} onPress={finish} />
      </SafeAreaView>
    );

  const item = items[index]!;
  const qid = item.question.id;
  const itemAttempts = attempts[qid] ?? [];
  const resolved = questionStatus(itemAttempts).resolved || session.resolved.includes(qid);
  const sourceCards = evidence;
  const meta = levelMeta(item.levelId);
  const isLast = index === n - 1;

  const onCheck = () => {
    const optionId = selected;
    if (!canCheck(itemAttempts, optionId) || resolved || inFlight.current) return;
    inFlight.current = true;
    setAnswering(true);
    setError(null);
    p.answerChapterReview(session.reviewId, item.question, optionId)
      .then((r) => {
        setAttempts((m) => ({ ...m, [qid]: [...(m[qid] ?? []), { optionId, correct: r.correct, rationale: r.rationale, wrong: r.wrong, explanation: r.explanation }] }));
        setSelected(undefined);
        feedback(r.correct ? 'correct' : 'incorrect');
      })
      .catch(() => setError('Couldn’t check that answer. Try again.'))
      .finally(() => {
        inFlight.current = false;
        setAnswering(false);
      });
  };

  const next = () => {
    setSelected(undefined);
    if (isLast) finish();
    setIndex(index + 1);
  };

  return (
    <LessonShell
      progress={(index + (resolved ? 1 : 0)) / n}
      onClose={leave}
      closeLabel="Leave the chapter review"
      scrollRef={scrollRef}
      contentKey={qid}
      footerTone={feedbackTone(itemAttempts)}
      feedback={
        itemAttempts.length > 0 || error ? (
          <>
            <QuestionFeedback attempts={itemAttempts} />
            {error && <Notice>{error}</Notice>}
          </>
        ) : null
      }
      footer={
        resolved ? (
          <Button variant="success" label={isLast ? 'Finish review' : 'Continue'} onPress={next} />
        ) : (
          <Button label={answering ? 'Checking' : 'Check'} loading={answering} disabled={!canCheck(itemAttempts, selected)} onPress={onCheck} />
        )
      }>
      <Caption>
        {skillName} · Chapter {chapter}
        {meta ? `, Level ${meta.number}` : ''} · {index + 1} of {n}
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

/** A modest moment, like a review's: the XP is small by design. */
function ChapterReviewComplete({ skillName, chapter, chapterTitle, result, onDone }: { skillName: string; chapter: number; chapterTitle?: string; result: ChapterReviewResult; onDone: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep, padding: layout.gutter }}>
      <BrainpowerFlight daily={result.daily ?? NO_DAILY}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg, alignItems: 'center' }}>
        <DrScroll spot="review-complete" size="md" />
        <Eyebrow tone="success">Chapter review complete</Eyebrow>
        <Body muted center>
          {skillName} · Chapter {chapter}
          {chapterTitle ? `: ${chapterTitle}` : ''}
        </Body>
        {/* No XP (nothing right first time) shows no number: the corrections were the point. */}
        {result.xpAwarded > 0 && (
          <Pop>
            <Numeral size="hero" tone="brand" accessibilityLabel={`plus ${result.xpAwarded} XP`}>
              +<CountUp to={result.xpAwarded} delay={200} /> XP
            </Numeral>
          </Pop>
        )}
        <Reveal delay={300}>
          <H2 center>
            {result.firstAttemptCorrect} / {result.total} right first time
          </H2>
        </Reveal>
        <Reveal delay={450}>
          <Body muted center>
            {result.questCredit
              ? 'Nothing new is left in this skill for you, so this review counts toward a Weekly Quest that needs it.'
              : `Up to +${XP.CHAPTER_REVIEW_MAX} XP each time, from what you get right on the first try.`}
          </Body>
        </Reveal>
        {result.daily && result.daily.brainpowerEarned.length > 0 && (
          <Reveal delay={600}>
            <BrainpowerEarned daily={result.daily} at={600} />
          </Reveal>
        )}
      </View>
      <Button label="Done" onPress={onDone} />
      </BrainpowerFlight>
    </SafeAreaView>
  );
}
