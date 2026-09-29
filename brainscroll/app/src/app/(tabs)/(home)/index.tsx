import { DR_SCROLL_LINES } from '@brainscroll/core';
import { Redirect, router } from 'expo-router';
import { useRef } from 'react';
import { View, type ScrollView } from 'react-native';
import { Button, Card, Caption, DrScrollSays, Emblem, Eyebrow, LevelArt, Loading, OfflineState, Row, Screen, Skeleton, SkeletonCard, Title } from '@/components/ui';
import { ChooseForMe } from '@/components/ChooseForMe';
import { StreakBadge } from '@/components/StreakBadge';
import { WorldMap, type Region } from '@/components/WorldMap';
import { levelByNumber, levelMeta, subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { todayLabel } from '@/progress/todayLabel';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { layout, radius, space, type } from '@/theme/tokens';

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
  const fresh = v.skills.every((k) => k.view.level === 0) && Object.keys(v.sessions).length === 0;

  return (
    <Screen
      scrollRef={scroller}
      header={
        <Row gap={space.sm}>
          <Emblem value={v.knowledgeLevel} size="sm" />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow>{todayLabel(today)}</Eyebrow>
            <Title>Knowledge Lv. {v.knowledgeLevel}</Title>
          </View>
          <StreakBadge />
        </Row>
      }>
      {fresh && <DrScrollSays spot="home.start" lines={[DR_SCROLL_LINES.homeStart]} />}
      {current && (
        <Card style={{ gap: space.md }}>
          <Row gap={space.md}>
            <LevelArt art={next?.art ?? levelByNumber(current.id, Math.max(current.view.level, 1))?.art} size={64} />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Eyebrow tone="brand">{today.dailyComplete ? 'Done for today' : 'Up next'}</Eyebrow>
              <Title>
                {current.name} · Lv. {current.view.level}
              </Title>
              <Caption>{next ? `Level ${next.number}, ${next.title}` : 'Every published level cleared'}</Caption>
            </View>
          </Row>
          <Button label="Continue" onPress={() => router.push({ pathname: '/skill/[id]', params: { id: current.id } })} />
        </Card>
      )}
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
        {/* The small level emblem's footprint. */}
        <Skeleton width={52} height={52} r={radius.md} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Skeleton width="45%" height={type.label.fontSize} />
          <Skeleton width="65%" height={type.title.lineHeight} />
        </View>
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
