import type { Card, QuestCompletion } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { track } from '@/analytics/track';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LearningCard } from '@/components/cards/LearningCard';
import { feedbackTone, QuestionCard, QuestionFeedback, questionStatus } from '@/components/cards/QuestionCard';
import { Body, Button, Caption, DrScroll, Eyebrow, H1, LessonShell, LessonSkeleton, LevelArt, LoadError, Notice, Numeral, Pop, Reveal, useCountUp } from '@/components/ui';
import { getCard, getSkill, levelMeta } from '@/content';
import type { FinalRoundItem } from '@/progress/backend';
import { useProgress, type AttemptView } from '@/progress/ProgressProvider';
import { useNewTrophies } from '@/progress/useNewTrophies';
import { questDef } from '@/progress/useQuests';
import { TrophyEarned } from '@/components/TrophyEarned';
import { feedback } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';

/**
 * A Weekly Quest's Final Round: a short lesson built from the levels that
 * counted. First one card from each of the quest's skills, then one question
 * per skill, in the lesson's own shell and question language. A miss shows the
 * source cards and the choices stay open until it's right; there's no
 * first-try score. When every question is resolved the quest completes: the
 * XP bonus, and the trophy if it's still the quest's live week.
 */
export default function FinalRoundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const def = id ? questDef(id) : undefined;
  const [items, setItems] = useState<FinalRoundItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [load, setLoad] = useState(0);
  // Steps: 0..n-1 are the cards (one per skill), n..2n-1 the questions.
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | undefined>();
  const [attempts, setAttempts] = useState<Record<string, AttemptView[]>>({});
  const [resolvedBefore, setResolvedBefore] = useState<string[]>([]);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<QuestCompletion | null>(null);
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id || !p.ready) return;
    p.openFinalRound(id).then(
      ({ view, items: loaded }) => {
        setFailed(false);
        const done = view.finalRound?.resolved ?? [];
        setResolvedBefore(done);
        if (done.length === 0) track('quest_final_round_started', { quest_id: id });
        setItems(loaded);
        // Pick up where you left off: straight to the first open question once any is answered.
        const firstOpen = loaded.findIndex((it) => !done.includes(it.question.id));
        setIndex(done.length === 0 ? 0 : firstOpen === -1 ? 2 * loaded.length : loaded.length + firstOpen);
      },
      () => setFailed(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, p.ready, load]);

  const leave = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  if (failed || !def) return <LoadError layout="screen" onRetry={() => setLoad((n) => n + 1)} onBack={leave} />;
  if (items === null) return <LessonSkeleton label="Loading the Final Round" />;
  if (result) return <QuestComplete title={def.title} art={def.art} trophyName={def.trophy.name} titleReward={def.titleReward} result={result} onDone={leave} />;

  const finish = () => {
    if (!id || finishing) return;
    setFinishing(true);
    setError(null);
    p.completeQuest(id)
      .then((r) => {
        feedback(r.liveClear ? 'milestone' : 'levelComplete');
        if (r.xpAwarded > 0 || r.liveClear) track('quest_completed', { quest_id: id, live_clear: r.liveClear });
        setResult(r);
      })
      .catch(() => setError('Couldn’t finish the quest. Your answers are kept, so try again.'))
      .finally(() => setFinishing(false));
  };

  const n = items.length;
  // Every question resolved (now or in an earlier visit): finish the quest.
  if (index >= 2 * n)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep, padding: layout.gutter }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg }}>
          <DrScroll spot="quest.final-round" size="md" />
          <Eyebrow tone="brand">Final Round</Eyebrow>
          <H1 center>All {n} answered.</H1>
          {error && <Notice>{error}</Notice>}
        </View>
        <Button label={finishing ? 'Finishing' : 'Finish the quest'} loading={finishing} onPress={finish} />
      </SafeAreaView>
    );

  // The lesson: one card from each skill.
  if (index < n) {
    const it = items[index]!;
    const card = getCard(it.question.sourceCardIds[0] ?? '');
    // The card can come from an earlier level than the one that counted: name the card's own level.
    const cardLevel = Number(card?.id.split('.')[2]);
    const meta = levelMeta(it.levelId);
    return (
      <LessonShell
        progress={index / (2 * n)}
        onClose={leave}
        closeLabel="Leave the Final Round"
        scrollRef={scrollRef}
        contentKey={`card-${index}`}
        footer={<Button label={index === n - 1 ? 'On to the questions' : 'Continue'} onPress={() => setIndex(index + 1)} />}>
        <Caption>
          Final Round · {meta ? `${getSkill(meta.skillId)?.name}, from Level ${Number.isFinite(cardLevel) && cardLevel > 0 ? cardLevel : meta.number}` : `Card ${index + 1}`} · {index + 1} of {n}
        </Caption>
        {card ? <LearningCard card={card} /> : <Body muted>This card is on its way.</Body>}
      </LessonShell>
    );
  }

  const q = index - n;
  const item = items[q]!;
  const qid = item.question.id;
  const itemAttempts = attempts[qid] ?? [];
  const resolved = questionStatus(itemAttempts).resolved || resolvedBefore.includes(qid);
  const sourceCards = item.question.sourceCardIds.map(getCard).filter((c): c is Card => !!c);
  const meta = levelMeta(item.levelId);

  const onCheck = () => {
    const optionId = selected;
    if (!optionId || resolved || inFlight.current || !id) return;
    inFlight.current = true;
    setAnswering(true);
    setError(null);
    p.answerFinalRound(id, qid, optionId)
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

  return (
    <LessonShell
      progress={(index + (resolved ? 1 : 0)) / (2 * n)}
      onClose={leave}
      closeLabel="Leave the Final Round"
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
          <Button
            variant="success"
            label={q === n - 1 ? 'Finish' : 'Continue'}
            onPress={() => {
              setSelected(undefined);
              setIndex(index + 1);
            }}
          />
        ) : (
          <Button label={answering ? 'Checking' : 'Check'} loading={answering} disabled={!selected} onPress={onCheck} />
        )
      }>
      <Caption>
        Final Round · Question {q + 1} of {n}
        {meta ? ` · ${getSkill(meta.skillId)?.name}` : ''}
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

/** The payoff: the trophy for a live-week clear, or the XP from the Archive. */
function QuestComplete({ title, art, trophyName, titleReward, result, onDone }: { title: string; art: string; trophyName: string; titleReward: string; result: QuestCompletion; onDone: () => void }) {
  const shown = useCountUp(result.xpAwarded, { delay: 400 });
  // Other trophies this finish unlocked (Quester, ...); the quest's own is shown above.
  const others = useNewTrophies(result.questId, result.trophy?.trophyId);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep, padding: layout.gutter }}>
      {/* Scrolls on small phones: the trophy, the XP and any other trophies can outgrow the screen. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.lg, alignItems: 'center', paddingVertical: space.lg }}>
        <DrScroll spot="quest.complete" size="md" />
        <Eyebrow tone="brand">Quest complete</Eyebrow>
        <H1 center>{title}</H1>
        {result.trophy ? (
          <Pop>
            <View style={{ alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={`Trophy earned: ${trophyName}`}>
              <LevelArt art={art} size={120} />
              <Body center>Trophy: {trophyName}</Body>
              <Caption center>Unlocked: the title “{titleReward}” and this quest’s emblem. Show them from Trophies.</Caption>
              <Button
                compact
                variant="secondary"
                label="Share"
                onPress={() => result.trophy && router.push({ pathname: '/share/[id]', params: { id: result.trophy.trophyId } })}
              />
            </View>
          </Pop>
        ) : null}
        {result.xpAwarded > 0 && (
          <Reveal delay={300}>
            <Numeral size="hero" tone="brand" accessibilityLabel={`plus ${result.xpAwarded} XP`}>
              +{shown} XP
            </Numeral>
          </Reveal>
        )}
        {others.length > 0 && (
          <View style={{ alignSelf: 'stretch' }}>
            <Reveal delay={450}>
              <TrophyEarned trophies={others} at={450} />
            </Reveal>
          </View>
        )}
        <Reveal delay={500}>
          <Body muted center>
            {result.liveClear ? 'Finished in its week. That one’s yours for good.' : 'Finished from the Archive: the knowledge and the XP are yours.'}
          </Body>
        </Reveal>
      </ScrollView>
      <Button label="Done" onPress={onDone} />
    </SafeAreaView>
  );
}
