import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, useWindowDimensions, View, type ScrollView } from 'react-native';
import { Body, Card, IconButton, Loading, OfflineState, Row, Screen, Skeleton, SkeletonCard } from '@/components/ui';
import { chaptersFor, levelMeta } from '@/content';
import { ChapterDivider, ChapterHeader, LevelPath } from '@/components/LevelPath';
import { MAP_TILE_WIDTH } from '@/components/MapTile';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { BrainpowerBadge } from '@/components/BrainpowerBadge';
import { BoostChip } from '@/components/cosmetics';
import { StreakBadge } from '@/components/StreakBadge';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { useStartLevel } from '@/progress/useStartLevel';
import { color, layout, space, type } from '@/theme/tokens';
import { QuestTile } from '@/components/QuestTile';
import { UnlimitedTile } from '@/components/UnlimitedTile';
import { featuredQuest, isLive, useQuests } from '@/progress/useQuests';

/** Completions whose cleared level has already popped on a map, so it pops once, in view. */
const popped = new WeakSet<object>();

/**
 * A skill's map: every chapter's level path, opened scrolled to the next level
 * (it bounces). The pinned bar says where you are and leads back to the World
 * Map (or the subject's region); under it, the chapter at the top of the map,
 * which turns into the next one as that chapter scrolls up (owner, 2026-10-10,
 * like Duolingo's unit header). The tiles (Unlimited, this week's quest) stay
 * pinned down the left as the map scrolls, and the map keeps clear of them.
 * Due reviews are offered on the World Map.
 */
export default function SkillMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  const startLevel = useStartLevel();
  // This week's quest, as a tile pinned down the left of the map (QuestTile shows it only while live).
  const quest = featuredQuest(useQuests().data);
  const tiles = !p.entitlement.active || (!!quest && isLive(quest));
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
  // The chapter named in the pinned header: the last one whose start has scrolled up to it.
  const [atTop, setAtTop] = useState<number | null>(null);
  const firstChapter = useRef<number | null>(null);
  const pickChapter = useCallback((y: number) => {
    let n = firstChapter.current;
    for (const [k, s] of Object.entries(spans.current)) if (s.y <= y && (n === null || Number(k) > n)) n = Number(k);
    setAtTop((prev) => (prev === n ? prev : n));
  }, []);
  const onScroll = useCallback(
    (y: number) => {
      scrollY.current = y;
      reveal();
      pickChapter(y);
    },
    [reveal, pickChapter],
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
  firstChapter.current = chapters[0]?.number ?? null;
  // Until the map has scrolled, the header names the chapter it opens on (the one you're in).
  const topChapter = chapters.find((c) => c.number === atTop) ?? chapters.find((c) => focus >= c.levels[0] && focus <= c.levels[1]) ?? chapters[0];
  const inset = tiles ? MAP_TILE_WIDTH + space.sm : 0;
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
          {topChapter && <ChapterHeader skillId={skill.id} chapter={topChapter} />}
        </>
      }
      overlay={
        tiles ? (
          <View pointerEvents="box-none" style={{ alignSelf: 'flex-start', gap: space.sm }}>
            <UnlimitedTile />
            {quest && <QuestTile quest={quest} />}
          </View>
        ) : undefined
      }>

      {!next && (
        <Card state="completed" style={{ marginLeft: inset }}>
          <Body muted>You’ve cleared every published level. More are on the way.</Body>
        </Card>
      )}

      {/* The whole skill as one map: each chapter after the first opens with its title. */}
      {chapters.map((c, i) => {
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
            {i > 0 && <ChapterDivider chapter={c} inset={inset} />}
            <LevelPath
              skillId={skill.id}
              chapter={c}
              level={skill.view.level}
              nextNumber={next?.number}
              dailyComplete={today.dailyComplete}
              justCleared={justCleared}
              mascot={here}
              inset={inset}
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
