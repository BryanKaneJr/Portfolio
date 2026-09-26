import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Body, Button, Card, Caption, Emblem, Eyebrow, LevelArt, Row, Screen, Title } from '@/components/ui';
import { ReviewStrip } from '@/components/ReviewStrip';
import { WorldMap, type Region } from '@/components/WorldMap';
import { getLevel, levelByNumber, subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { todayLabel } from '@/progress/todayLabel';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { space } from '@/theme/tokens';

/**
 * Home is the World Map (owner direction: RPG-inspired, a map of the
 * categories first). Every subject is an island showing your level in it; the
 * one you're playing flies a flag. The Current Quest card continues where you
 * left off, and due reviews wait just above it.
 */
export default function WorldScreen() {
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  if (!p.ready) return <Screen>{null}</Screen>;
  if (p.account?.status !== 'signed_in') return <Redirect href="/sign-in" />;
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
  const next = nextId ? getLevel(nextId) : undefined;
  const { today } = v;

  return (
    <Screen
      header={
        <Row gap={space.sm}>
          <Emblem value={v.knowledgeLevel} size="sm" />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow>
              World map · {todayLabel(today)}
            </Eyebrow>
            <Title>Knowledge Lv. {v.knowledgeLevel}</Title>
          </View>
        </Row>
      }>
      {p.error && (
        <Card variant="quiet">
          <Eyebrow>Offline</Eyebrow>
          <Body muted>Couldn’t reach BrainScroll’s servers. Check your connection and reopen the app.</Body>
        </Card>
      )}
      <ReviewStrip />
      {current && (
        <Card style={{ gap: space.md }}>
          <Row gap={space.md}>
            <LevelArt art={next?.art ?? levelByNumber(current.id, Math.max(current.view.level, 1))?.art} size={64} />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Eyebrow tone="brand">Current quest{today.dailyComplete ? ' · done for today' : ''}</Eyebrow>
              <Title>
                {current.name} · Lv. {current.view.level}
              </Title>
              <Caption>{next ? `Next: Level ${next.number}, ${next.title}` : 'Every published level cleared'}</Caption>
            </View>
          </Row>
          <Button label="Continue" onPress={() => router.push({ pathname: '/skill/[id]', params: { id: current.id } })} />
        </Card>
      )}
      <WorldMap regions={regions} hereId={current?.subjectId} onOpen={openSubject} />
    </Screen>
  );
}
