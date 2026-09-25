import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { Body, Button, Caption, Card, Chip, Emblem, Eyebrow, Pips, ProgressBar, Row, Screen, Stars, Title } from '@/components/ui';
import { getLevel, subjectName } from '@/content';
import { LevelPath } from '@/components/LevelPath';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';
import { space } from '@/theme/tokens';

/**
 * Home answers one question: what should I learn next? The current chapter's
 * level path owns the screen (the next level bounces); today's allowance and
 * review are secondary.
 */
export default function HomeScreen() {
  const p = useProgress();
  const v = useProgressView();
  const startLevel = useStartLevel();
  const { ready, refresh } = p;
  // Reviews come due while the app sits open; re-check whenever Home is shown.
  useFocusEffect(
    useCallback(() => {
      if (ready) void refresh().catch(() => {});
    }, [ready, refresh]),
  );
  if (!p.ready) return <Screen>{null}</Screen>;
  if (p.account?.status !== 'signed_in') return <Redirect href="/sign-in" />;
  if (!p.onboarded) return <Redirect href="/welcome" />;

  // The skill to continue: the active one, else one with a level in progress,
  // else the furthest along, else the first skill that has levels to play.
  const playable = v.skills.filter((s) => p.nextLevelId(s.id) || s.view.level > 0);
  const skill =
    v.skills.find((s) => s.id === p.activeSkillId) ??
    playable.find((s) => Object.keys(v.sessions).some((id) => id.startsWith(s.id.replace(/^skill\./, 'level.') + '.'))) ??
    [...playable].sort((a, b) => b.view.level - a.view.level)[0] ??
    v.skills[0]!;
  const nextId = p.nextLevelId(skill.id);
  const next = nextId ? getLevel(nextId) : undefined;
  const resuming = nextId ? v.sessions[nextId] : undefined;
  const { today } = v;
  // The level just finished pops on the path when Home comes back into view.
  const last = p.lastSummary;
  const justCleared = last && last.skillId === skill.id && !last.alreadyCompleted ? getLevel(last.levelId)?.number : undefined;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow tone="brand">BrainScroll</Eyebrow>
        <Chip tone="brand" icon="knowledge">
          <Caption tone="text">Knowledge Lv. {v.knowledgeLevel}</Caption>
        </Chip>
      </Row>

      {p.error && (
        <Card variant="quiet">
          <Eyebrow>Offline</Eyebrow>
          <Body muted>Couldn’t reach BrainScroll’s servers. Check your connection and reopen the app.</Body>
        </Card>
      )}

      <Row gap={space.md}>
        <Emblem value={skill.view.level} size="sm" />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Eyebrow>{subjectName(skill.subjectId)}</Eyebrow>
          <Title>
            {skill.name} · Lv. {skill.view.level}
          </Title>
        </View>
        <Stars count={skill.view.stars} />
      </Row>

      {next ? (
        <LevelPath
          skillId={skill.id}
          level={skill.view.level}
          nextNumber={next.number}
          resuming={!!resuming}
          dailyComplete={today.dailyComplete}
          justCleared={justCleared}
          onOpen={startLevel}
        />
      ) : (
        <Card>
          <Body muted>You’ve cleared every published level. More are on the way.</Body>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Today</Eyebrow>
          <Caption>
            {today.used} / {today.cap ?? '∞'} new levels
          </Caption>
        </Row>
        {today.cap !== null ? <Pips filled={today.used} total={today.cap} /> : <ProgressBar value={1} tone="info" size="sm" />}
        <Caption>{today.dailyComplete ? 'Done for today. Review stays open.' : 'Review never uses these.'}</Caption>
      </Card>

      {v.reviewsDue > 0 && (
        <Card>
          <Eyebrow tone="success">Review</Eyebrow>
          <Body>
            {v.reviewsDue} {v.reviewsDue === 1 ? 'thing' : 'things'} worth refreshing
          </Body>
          <Button variant={today.dailyComplete ? 'primary' : 'secondary'} label="Start review" onPress={() => router.push('/review-session')} />
        </Card>
      )}
    </Screen>
  );
}
