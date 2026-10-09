import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { track } from '@/analytics/track';
import { View } from 'react-native';
import { Body, Button, Caption, Card, Chip, Eyebrow, H1, IconButton, LevelArt, LoadError, Loading, Notice, ProgressBar, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { getSkill, levelByNumber, quests as questDefs } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { lastDay, questDef, questStatusLine, questTotals, useQuests } from '@/progress/useQuests';
import { feedback } from '@/theme/feedback';
import { space } from '@/theme/tokens';

/**
 * One Weekly Quest: five skills × five new levels, then a three-question Final
 * Round. Live this week (the trophy is for finishing inside it), or in the
 * Archive (still worth the XP, no trophy). Calm copy only: no countdowns.
 */
export default function QuestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const { skills } = useProgressView();
  const { data, failed, reload } = useQuests();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const def = id ? questDef(id) : undefined;
  const quest = data?.quests.find((q) => q.id === id);
  // Which themes people open (once per visit, when its state is known).
  const viewedState = quest?.state;
  useEffect(() => {
    if (id && viewedState) track('quest_viewed', { quest_id: id, state: viewedState });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!viewedState]);

  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>{quest?.state === 'live' ? 'This week’s quest' : quest ? 'Archive' : 'Weekly quest'}</Eyebrow>
        <Title>{def?.title ?? 'Quest'}</Title>
      </View>
    </Row>
  );
  if (failed) return <LoadError layout="screen" onRetry={() => void reload()} onBack={() => router.back()} />;
  if (!data || !def)
    return (
      <Screen header={header}>
        <Loading label="Loading the quest">
          <SkeletonCard art={96} lines={2} />
          <SkeletonCard lines={3} />
        </Loading>
      </Screen>
    );
  if (!quest)
    return (
      <Screen header={header}>
        <Notice tone="muted">This quest hasn’t started yet.</Notice>
      </Screen>
    );

  const { done, required } = questTotals(quest);
  const live = quest.state === 'live' || (quest.state === 'completed' && quest.liveClear);
  const otherActive = data.quests.find((q) => q.id !== quest.id && q.state === 'archive' && q.active);
  const round = quest.finalRound;
  const roundDone = round ? round.resolved.length : 0;

  const start = () => {
    setStarting(true);
    setError(null);
    p.startQuest(quest.id)
      .then(() => {
        feedback('select');
        track('quest_started', { quest_id: quest.id });
        return reload();
      })
      .catch(() => setError('Couldn’t start it. Try again.'))
      .finally(() => setStarting(false));
  };

  return (
    <Screen header={header}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <LevelArt art={def.art} size={112} />
        <H1 center>{def.title}</H1>
        <Body muted center>
          {def.tagline}
        </Body>
        <Chip tone={quest.state === 'completed' ? 'success' : quest.state === 'live' ? 'brand' : 'muted'}>
          <Caption>{questStatusLine(quest)}</Caption>
        </Chip>
      </View>

      <Card style={{ gap: space.md }}>
        <Row gap={space.sm} style={{ justifyContent: 'space-between' }}>
          <Eyebrow>New levels</Eyebrow>
          <Caption>
            {done} / {required}
          </Caption>
        </Row>
        <ProgressBar value={required ? done / required : 0} label={`${done} of ${required} new levels`} />
        {quest.requirements.map((r) => {
          const skill = skills.find((s) => s.id === r.skillId);
          const name = getSkill(r.skillId)?.name ?? r.skillId;
          const count = Math.min(r.done, r.required);
          return (
            <Card
              key={r.skillId}
              variant="quiet"
              accessibilityLabel={`${name}: ${count} of ${r.required} new levels. Open the skill map.`}
              onPress={() => router.push({ pathname: '/skill/[id]', params: { id: r.skillId } })}
              state={count >= r.required ? 'completed' : undefined}
              style={{ paddingVertical: space.sm }}>
              <Row gap={space.md}>
                <LevelArt art={levelByNumber(r.skillId, skill?.view.nextLevel ?? 1)?.art} size={40} />
                <Body style={{ flex: 1 }}>{name}</Body>
                <Caption>
                  {count} / {r.required}
                </Caption>
              </Row>
            </Card>
          );
        })}
        {quest.active && quest.state !== 'completed' && (
          <Caption>Only new levels count: a level you’ve already cleared doesn’t, and replays and review don’t either.</Caption>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <Eyebrow>Final Round</Eyebrow>
        {quest.state === 'completed' ? (
          <Body>Done: a card and a question from every skill in the quest.</Body>
        ) : quest.finalRoundUnlocked ? (
          <>
            <Body>A short lesson from the levels you did for this quest: a card from each skill, then a question on each.</Body>
            <Button
              label={round && roundDone > 0 ? `Continue the Final Round (${roundDone} / ${round.questionIds.length})` : 'Start the Final Round'}
              onPress={() => router.push({ pathname: '/final-round/[id]', params: { id: quest.id } })}
            />
          </>
        ) : (
          <Body muted>
            Unlocks at {required} / {required}: a short lesson with a card from each skill, then a question on each.
          </Body>
        )}
      </Card>

      <Card style={{ gap: space.sm }}>
        <Eyebrow>Rewards</Eyebrow>
        <Body>+{def.xpReward} XP when you finish.</Body>
        {live ? (
          <Body>
            Trophy: {def.trophy.name}, with the title “{def.titleReward}” and this quest’s emblem
            {quest.state === 'live' ? `, for finishing by ${lastDay(quest.endsAt)}` : ''}.
          </Body>
        ) : (
          <Body muted>The trophy, title and emblem were for finishing in its week. From the Archive it’s the knowledge and the XP.</Body>
        )}
      </Card>

      {quest.state === 'archive' && !quest.active && (
        <View style={{ gap: space.sm }}>
          <Button label={starting ? 'Starting' : 'Start this quest'} loading={starting} onPress={start} />
          <Caption>
            {otherActive
              ? `You can work on one Archive quest at a time. Starting this one resets ${questDefs.find((q) => q.id === otherActive.id)?.title ?? 'the other one'}.`
              : 'New levels count from now. If you worked on it during its week, that progress carries over.'}
          </Caption>
          {error && <Notice>{error}</Notice>}
        </View>
      )}

      <Button variant="secondary" label="See the Archive" onPress={() => router.push('/quests')} />
    </Screen>
  );
}
