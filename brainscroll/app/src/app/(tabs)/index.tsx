import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { Body, Button, Card, Emblem, Eyebrow, Icon, IconButton, Row, Screen, Stars, Title } from '@/components/ui';
import { chaptersFor, getLevel, subjectName } from '@/content';
import { LevelPath } from '@/components/LevelPath';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';
import { color, radius, space } from '@/theme/tokens';

/**
 * Home answers one question: what should I learn next? The current chapter's
 * level path owns the screen (the next level bounces); today's allowance and
 * review are secondary.
 */
export default function HomeScreen() {
  const p = useProgress();
  const v = useProgressView();
  const startLevel = useStartLevel();
  const scroll = useRef<ScrollView>(null);
  const [pathY, setPathY] = useState<number | null>(null);
  const [stopY, setStopY] = useState<number | null>(null);
  // Bring the next level into view, about a third of the way down the screen.
  useEffect(() => {
    // Only when it would sit low on the screen; a new learner sees their first chapter from the top.
    if (pathY !== null && stopY !== null && pathY + stopY > 360) scroll.current?.scrollTo({ y: pathY + stopY - 220, animated: false });
  }, [pathY, stopY]);
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

  const focus = next?.number ?? Math.max(skill.view.level, 1);
  const chapters = chaptersFor(skill.id);

  return (
    <Screen
      scrollRef={scroll}
      header={
        <>
          <Row gap={space.sm}>
            <IconButton label="All skills" icon="back" onPress={() => router.navigate('/skills')} />
            <Emblem value={skill.view.level} size="sm" />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Eyebrow>
                {subjectName(skill.subjectId)} · Today {today.used} / {today.cap ?? '∞'}
              </Eyebrow>
              <Title>
                {skill.name} · Lv. {skill.view.level}
              </Title>
            </View>
            <Stars count={skill.view.stars} />
          </Row>
          {v.reviewsDue > 0 && (
            <Row gap={space.md} style={styles.review}>
              <Icon name="book" tint={color.success} size={20} />
              <Body style={{ flex: 1 }}>
                {v.reviewsDue} {v.reviewsDue === 1 ? 'thing' : 'things'} worth refreshing
              </Body>
              <Button compact variant={today.dailyComplete ? 'primary' : 'secondary'} label="Start review" onPress={() => router.push('/review-session')} />
            </Row>
          )}
        </>
      }>
      {p.error && (
        <Card variant="quiet">
          <Eyebrow>Offline</Eyebrow>
          <Body muted>Couldn’t reach BrainScroll’s servers. Check your connection and reopen the app.</Body>
        </Card>
      )}

      {!next && (
        <Card>
          <Body muted>You’ve cleared every published level. More are on the way.</Body>
        </Card>
      )}

      {/* The whole skill as one map: each chapter's banner sits where that chapter begins. */}
      {chapters.map((c) => {
        const here = focus >= c.levels[0] && focus <= c.levels[1];
        return (
          <View key={c.number} onLayout={here ? (e) => setPathY(e.nativeEvent.layout.y) : undefined}>
            <LevelPath
              skillId={skill.id}
              chapter={c}
              level={skill.view.level}
              nextNumber={next?.number}
              resuming={!!resuming}
              dailyComplete={today.dailyComplete}
              justCleared={justCleared}
              mascot={here}
              teaser={false}
              onCurrent={here ? setStopY : undefined}
              onOpen={startLevel}
            />
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  review: { backgroundColor: color.successSoft, borderRadius: radius.md, borderWidth: 2, borderColor: color.successLine, paddingLeft: space.md, paddingRight: space.xs, paddingVertical: space.xs },
});
