import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View, type ScrollView } from 'react-native';
import { Body, Card, Emblem, Eyebrow, IconButton, Row, Screen, Stars, Title } from '@/components/ui';
import { chaptersFor, levelMeta, subjectName } from '@/content';
import { LevelPath } from '@/components/LevelPath';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { todayLabel } from '@/progress/todayLabel';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { useStartLevel } from '@/progress/useStartLevel';
import { space } from '@/theme/tokens';

/**
 * A skill's map: every chapter's level path, opened scrolled to the next level
 * (it bounces). The pinned bar says where you are and leads back to the World
 * Map (or the subject's region). Due reviews are offered on the World Map.
 */
export default function SkillMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  const { setActiveSkill, activeSkillId } = p;
  // Opening a skill's map makes it the one the World Map's quest card continues.
  useEffect(() => {
    if (id && id !== activeSkillId && v.skills.some((s) => s.id === id)) setActiveSkill(id);
  }, [id, activeSkillId, setActiveSkill, v.skills]);
  const startLevel = useStartLevel();
  const scroll = useRef<ScrollView>(null);
  const [pathY, setPathY] = useState<number | null>(null);
  const [stopY, setStopY] = useState<number | null>(null);
  // Bring the next level into view, about a third of the way down the screen.
  useEffect(() => {
    // Only when it would sit low on the screen; a new learner sees their first chapter from the top.
    if (pathY !== null && stopY !== null && pathY + stopY > 360) scroll.current?.scrollTo({ y: pathY + stopY - 220, animated: false });
  }, [pathY, stopY]);
  if (!p.ready) return <Screen>{null}</Screen>;
  if (p.account?.status !== 'signed_in') return <Redirect href="/sign-in" />;
  if (!p.onboarded) return <Redirect href="/welcome" />;

  const skill = v.skills.find((s) => s.id === id) ?? current;
  if (!skill) return <Redirect href="/" />;
  const nextId = p.nextLevelId(skill.id);
  const next = nextId ? levelMeta(nextId) : undefined;
  const resuming = nextId ? v.sessions[nextId] : undefined;
  const { today } = v;
  // The level just finished pops on the path when Home comes back into view.
  const last = p.lastSummary;
  const justCleared = last && last.skillId === skill.id && !last.alreadyCompleted ? levelMeta(last.levelId)?.number : undefined;

  const focus = next?.number ?? Math.max(skill.view.level, 1);
  const chapters = chaptersFor(skill.id);
  // A subject with several skills goes back to its region; otherwise straight to the World Map.
  const multi = v.skills.filter((k) => k.subjectId === skill.subjectId).length > 1;

  return (
    <Screen
      scrollRef={scroll}
      header={
        <Row gap={space.sm}>
          <IconButton
            label={multi ? `Back to ${subjectName(skill.subjectId)}` : 'World map'}
            icon="back"
            onPress={() => router.navigate(multi ? { pathname: '/subject/[id]', params: { id: skill.subjectId } } : '/')}
          />
          <Emblem value={skill.view.level} size="sm" />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow>
              {subjectName(skill.subjectId)} · {todayLabel(today)}
            </Eyebrow>
            <Title>
              {skill.name} · Lv. {skill.view.level}
            </Title>
          </View>
          <Stars count={skill.view.stars} />
        </Row>
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
