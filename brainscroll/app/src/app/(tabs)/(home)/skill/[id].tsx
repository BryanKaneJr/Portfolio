import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, useWindowDimensions, View, type ScrollView } from 'react-native';
import { Body, Card, IconButton, Loading, OfflineState, Row, Screen, Skeleton, SkeletonCard } from '@/components/ui';
import { chaptersFor, levelMeta } from '@/content';
import { LevelPath } from '@/components/LevelPath';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { BrainpowerBadge } from '@/components/BrainpowerBadge';
import { BoostChip } from '@/components/cosmetics';
import { StreakBadge } from '@/components/StreakBadge';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { useStartLevel } from '@/progress/useStartLevel';
import { color, layout, space, type } from '@/theme/tokens';
import { QuestTile } from '@/components/QuestTile';
import { featuredQuest, useQuests } from '@/progress/useQuests';

/** Completions whose cleared level has already popped on a map, so it pops once, in view. */
const popped = new WeakSet<object>();

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
  const startLevel = useStartLevel();
  // This week's quest, as a tile beside the road (QuestTile shows it only while live).
  const quest = featuredQuest(useQuests().data);
  const scroll = useRef<ScrollView>(null);
  const [pathY, setPathY] = useState<number | null>(null);
  const [stopY, setStopY] = useState<number | null>(null);
  // Chapters near the screen draw their whole map; the rest wait as banners of
  // the right height (drawing all ten at once took seconds on a phone). Once
  // drawn, a chapter stays drawn.
  const { height: screenH } = useWindowDimensions();
  const scrollY = useRef(0);
  const spans = useRef<Record<number, { y: number; h: number }>>({});
  const [live, setLive] = useState<ReadonlySet<number>>(new Set());
  // Draw every chapter within a screen above or two below what's in view.
  const reveal = useCallback(() => {
    const from = scrollY.current - screenH;
    const to = scrollY.current + 2 * screenH;
    const near = Object.entries(spans.current).filter(([, s]) => s.y < to && s.y + s.h > from).map(([n]) => Number(n));
    setLive((prev) => (near.every((n) => prev.has(n)) ? prev : new Set([...prev, ...near])));
  }, [screenH]);
  const onScroll = useCallback(
    (y: number) => {
      scrollY.current = y;
      reveal();
    },
    [reveal],
  );
  // Layout only records where chapters are: drawing follows scrolling (the
  // open-at-your-level scroll included), so chapters far above aren't drawn
  // while the map is still at the top. Yours and its neighbours draw anyway.
  const onChapterLayout = useCallback((n: number, y: number, h: number) => {
    spans.current[n] = { y, h };
  }, []);
  // The level just cleared pops (and the next one wakes) when the map is back in
  // view, not while it was hidden under the lesson and Level Complete.
  const skillKey = id ?? current?.id;
  const [cleared, setCleared] = useState<number | undefined>();
  useFocusEffect(
    useCallback(() => {
      const last = p.lastSummary;
      if (!last || popped.has(last) || last.skillId !== skillKey || last.alreadyCompleted) return;
      popped.add(last);
      setCleared(levelMeta(last.levelId)?.number);
    }, [p.lastSummary, skillKey]),
  );
  // Bring the next level into view, about a third of the way down the screen:
  // on opening, and when it moves on (a level cleared). Not on every return,
  // so coming back from a replay leaves the map where the learner had it.
  const target = `${skillKey}:${p.nextLevelId(skillKey ?? '') ?? 'done'}`;
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (pathY === null || stopY === null || scrolledFor.current === target) return;
    // Settle first: after a level is cleared the measurements arrive over a frame or two.
    // Then check it took: opened from a link or a reload, the map can still be
    // on its way in, and a scroll then does nothing, so try again shortly.
    let timer = setTimeout(function attempt(tries = 0) {
      scrolledFor.current = target;
      // Only when it would sit low on the screen; a new learner sees their first chapter from the top.
      if (pathY + stopY <= 360) return;
      const y = pathY + stopY - 220;
      scroll.current?.scrollTo({ y, animated: false });
      timer = setTimeout(() => {
        if (Math.abs(scrollY.current - y) > 40 && tries < 12) attempt(tries + 1);
      }, 150);
    }, 60);
    return () => clearTimeout(timer);
  }, [pathY, stopY, target]);
  if (!p.ready)
    return (
      // The same scroll ref as the map: React keeps this ScrollView when the map
      // replaces the skeleton, and a ref added only then never attached (a cold
      // link or reload then couldn't scroll to the next level).
      <Screen scrollRef={scroll}>
        <Loading label="Loading the skill map">
          <Skeleton width="60%" height={type.title.lineHeight} />
          <SkeletonCard lines={1} />
          {/* The level path's nodes, in outline. */}
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} circle height={layout.buttonHeight + space.lg} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', marginHorizontal: space.xxxl }} />
          ))}
        </Loading>
      </Screen>
    );
  if (p.account?.status !== 'signed_in') return <Redirect href="/sign-in" />;
  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;
  if (!p.onboarded) return <Redirect href="/welcome" />;

  const skill = v.skills.find((s) => s.id === id) ?? current;
  if (!skill) return <Redirect href="/" />;
  const nextId = p.nextLevelId(skill.id);
  const next = nextId ? levelMeta(nextId) : undefined;
  const { today } = v;
  const justCleared = cleared;

  const focus = next?.number ?? Math.max(skill.view.level, 1);
  const chapters = chaptersFor(skill.id);
  // A subject with several skills goes back to its region; otherwise straight to the World Map.
  const multi = v.skills.filter((k) => k.subjectId === skill.subjectId).length > 1;

  return (
    <Screen
      scrollRef={scroll}
      onScroll={onScroll}
      header={
        // Back, the skill's name, and the same Brainpower and streak chips as Home (owner, 2026-10-06).
        <>
          <Row gap={space.sm}>
            <IconButton
              label="Back"
              icon="back"
              onPress={() =>
                // Up to the parent, back through the stack when it's there; history back looped skill and region on the web.
                router.dismissTo(multi ? { pathname: '/subject/[id]', params: { id: skill.subjectId } } : '/')
              }
            />
            <Text accessibilityRole="header" numberOfLines={2} style={[type.bodyStrong, { flex: 1, color: color.text }]}>
              {skill.name}
            </Text>
            <BrainpowerBadge />
            <StreakBadge />
          </Row>
          {/* A running XP boost's time left, centered under the bar (owner, 2026-10-09: players need to see it). */}
          <BoostChip centered testID="boost-chip-map" />
        </>
      }>

      {!next && (
        <Card state="completed">
          <Body muted>You’ve cleared every published level. More are on the way.</Body>
        </Card>
      )}

      {/* The whole skill as one map: each chapter's banner sits where that chapter begins. */}
      {chapters.map((c) => {
        const here = focus >= c.levels[0] && focus <= c.levels[1];
        // The chapter you're in and its neighbours draw straight away.
        const nearFocus = Math.abs(c.levels[0] - (focus - ((focus - 1) % 10))) <= 10;
        return (
          <View
            key={c.number}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              onChapterLayout(c.number, y, height);
              if (here) setPathY(y);
            }}>
            <LevelPath
              skillId={skill.id}
              chapter={c}
              level={skill.view.level}
              nextNumber={next?.number}
              dailyComplete={today.dailyComplete}
              justCleared={justCleared}
              mascot={here}
              aside={here && quest ? <QuestTile quest={quest} /> : undefined}
              teaser={false}
              onCurrent={here ? setStopY : undefined}
              onOpen={startLevel}
              live={nearFocus || live.has(c.number)}
              chestsOpened={p.snapshot.locker.chests}
              onChest={(n) => router.push({ pathname: '/chest', params: { skillId: skill.id, chapter: String(n) } })}
            />
          </View>
        );
      })}
    </Screen>
  );
}
