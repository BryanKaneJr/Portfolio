import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { Body, Button, Caption, Card, Chip, Emblem, Eyebrow, H1, LevelArt, Pips, ProgressBar, Row, Screen, Stars, Title } from '@/components/ui';
import { getLevel, subjectName } from '@/content';
import { ChapterRail } from '@/components/ChapterRail';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';
import { space } from '@/theme/tokens';

/**
 * Home answers one question: what should I learn next? One dominant Continue
 * card owns the screen; today's allowance and review are secondary.
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
  const chapterStart = (skill.view.band - 1) * MASTERY_BAND_SIZE + (skill.view.chapter - 1) * 10 + 1;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow tone="brand">BrainScroll</Eyebrow>
        <Chip tone="brand">
          <Caption tone="text">Knowledge Lv. {v.knowledgeLevel}</Caption>
        </Chip>
      </Row>

      {p.error && (
        <Card variant="quiet">
          <Eyebrow>Offline</Eyebrow>
          <Body muted>Couldn’t reach BrainScroll’s servers. Check your connection and reopen the app.</Body>
        </Card>
      )}

      <Card variant="accent" style={{ padding: space.xl, gap: space.lg }}>
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

        {next && <LevelArt art={next.art} size={128} style={{ alignSelf: 'center' }} />}
        <View style={{ gap: space.xs }}>
          <Eyebrow tone="brand">{resuming ? 'Pick up where you left off' : 'Continue learning'}</Eyebrow>
          {next ? (
            <>
              <H1>{next.title}</H1>
              <Caption>Level {next.number} · {next.objective.replace(/^After this level you can /, 'You’ll ')}</Caption>
            </>
          ) : (
            <Body muted>You’ve cleared every published level. More are on the way.</Body>
          )}
        </View>

        <View style={{ gap: space.xs }}>
          <ChapterRail start={chapterStart} level={skill.view.level} next={skill.view.nextLevel} />
          <Caption>
            Chapter {skill.view.chapter} · {skill.view.level % MASTERY_BAND_SIZE} / {MASTERY_BAND_SIZE} toward ★
          </Caption>
        </View>

        {next && today.dailyComplete ? (
          <Button variant="secondary" label="Daily knowledge complete" onPress={() => router.push('/daily-complete')} />
        ) : next ? (
          <Button label={resuming ? `Resume Level ${next.number}` : `Start Level ${next.number}`} onPress={() => startLevel(next.id)} />
        ) : null}
      </Card>

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
