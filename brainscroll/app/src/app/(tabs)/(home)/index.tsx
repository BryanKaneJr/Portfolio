import { DR_SCROLL_LINES } from '@brainscroll/core';
import { Redirect, router } from 'expo-router';
import { useRef } from 'react';
import { View, type ScrollView } from 'react-native';
import { Button, Card, Caption, DrScrollSays, Eyebrow, LevelArt, Loading, OfflineState, Row, Screen, Skeleton, SkeletonCard, Title } from '@/components/ui';
import { ChooseForMe } from '@/components/ChooseForMe';
import { BrainpowerBadge } from '@/components/BrainpowerBadge';
import { LevelBadge } from '@/components/LevelBadge';
import { StreakBadge } from '@/components/StreakBadge';
import { WorldMap, type Region } from '@/components/WorldMap';
import { levelByNumber, levelMeta, subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { QuestCard } from '@/components/QuestCard';
import { featuredQuest, useQuests } from '@/progress/useQuests';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { subjectTint } from '@/theme/subjectTheme';
import { layout, radius, space } from '@/theme/tokens';

/**
 * Home is the World Map (owner direction: RPG-inspired, a map of the
 * categories first). Every subject is an island showing your level in it; the
 * one you're playing flies a flag. The Current Quest card continues where you
 * left off; "Choose for me" sits under the subjects for when you don't know
 * what to learn next. Review lives only in its tab (owner decision): nothing about it here.
 */
export default function WorldScreen() {
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  const scroller = useRef<ScrollView>(null);
  const quests = useQuests();
  // The same scroll view outlives the loading state, and react-native-web only
  // attaches its ref on mount, so the loading screen must pass it too.
  if (!p.ready)
    return (
      <Screen scrollRef={scroller}>
        <HomeSkeleton />
      </Screen>
    );
  if (p.account?.status !== 'signed_in') return <Redirect href="/sign-in" />;
  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;
  if (!p.onboarded) return <Redirect href="/welcome" />;

  const regions: Region[] = subjects
    .map((s) => {
      const skills = v.skills.filter((k) => k.subjectId === s.id);
      return { subjectId: s.id, name: s.name, levelsCleared: skills.reduce((n, k) => n + k.view.level, 0), skills: skills.map((k) => k.name) };
    })
    .filter((r) => r.skills.length > 0);

  const openSubject = (subjectId: string) => {
    const skills = v.skills.filter((k) => k.subjectId === subjectId);
    if (skills.length === 1) router.push({ pathname: '/skill/[id]', params: { id: skills[0]!.id } });
    else router.push({ pathname: '/subject/[id]', params: { id: subjectId } });
  };

  const nextId = current ? p.nextLevelId(current.id) : undefined;
  const next = nextId ? levelMeta(nextId) : undefined;
  const { today } = v;
  // Nothing started yet: no level cleared and none in progress.
  const quest = featuredQuest(quests.data);
  const fresh = v.skills.every((k) => k.view.level === 0) && !v.hasOpenLevel;

  return (
    <Screen
      scrollRef={scroller}
      header={
        // Three stat chips (owner, 2026-10-03): the Knowledge Level on the left, Brainpower and the streak on the right.
        <Row gap={space.sm}>
          <LevelBadge />
          <View style={{ flex: 1 }} />
          <BrainpowerBadge />
          <StreakBadge />
        </Row>
      }>
      {fresh && <DrScrollSays spot="home.start" lines={[DR_SCROLL_LINES.homeStart]} />}
      {current && (
        // Framed in the skill's subject colour; Continue stays violet (the action).
        <Card style={{ gap: space.md, borderColor: subjectTint(current.subjectId).line }}>
          <Row gap={space.md}>
            <LevelArt art={next?.art ?? levelByNumber(current.id, Math.max(current.view.level, 1))?.art} size={64} />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Eyebrow style={{ color: subjectTint(current.subjectId).text }}>{today.dailyComplete ? 'Out of Brainpower' : 'Up next'}</Eyebrow>
              <Title>
                {current.name} · Lv. {current.view.level}
              </Title>
              <Caption>{next ? `Level ${next.number}, ${next.title}` : 'Every published level cleared'}</Caption>
            </View>
          </Row>
          <Button label="Continue" onPress={() => router.push({ pathname: '/skill/[id]', params: { id: current.id } })} />
        </Card>
      )}
      {quest && <QuestCard quest={quest} />}
      <WorldMap regions={regions} hereId={current?.subjectId} onOpen={openSubject} />
      <ChooseForMe onChoice={() => scroller.current?.scrollToEnd({ animated: true })} />
    </Screen>
  );
}

/** Home on its way: the header, the quest card and the subject grid, in outline. */
function HomeSkeleton() {
  return (
    <Loading label="Loading your subjects">
      <Row gap={space.sm}>
        {/* The level chip's footprint. */}
        <Skeleton width={62} height={36} r={radius.pill} />
      </Row>
      <SkeletonCard art={64} lines={1} action />
      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={layout.buttonHeight * 3} r={radius.lg} style={{ flexBasis: '47%', flexGrow: 1 }} />
        ))}
      </Row>
    </Loading>
  );
}
