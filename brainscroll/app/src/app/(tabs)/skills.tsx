import { MASTERY_BAND_SIZE, subjectRank } from '@brainscroll/core';
import { View } from 'react-native';
import { Caption, Card, Chip, Emblem, Eyebrow, LevelArt, ProgressBar, Row, Screen, ScreenHeader, Stars, Title } from '@/components/ui';
import { levelByNumber, levelsForSkill, subjectName, subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';
import { ChapterRail } from '@/components/ChapterRail';
import { space } from '@/theme/tokens';

/**
 * Skills you are leveling, not a course catalog. Each skill shows its level
 * emblem, subject rank, mastery stars, the active 10-level chapter and the
 * road to the next ★. Never 100 equal dots.
 */
export default function SkillsScreen() {
  const p = useProgress();
  const { skills } = useProgressView();
  const startLevel = useStartLevel();
  const upcoming = subjects.filter((s) => !skills.some((k) => k.subjectId === s.id));

  return (
    <Screen>
      <ScreenHeader eyebrow="Your build" title="Skills" />
      {skills.map((s) => {
        const chapterStart = (s.view.band - 1) * MASTERY_BAND_SIZE + (s.view.chapter - 1) * 10 + 1;
        const published = levelsForSkill(s.id).length;
        const nextId = p.nextLevelId(s.id);
        const rank = subjectRank(skills.filter((k) => k.subjectId === s.subjectId).map((k) => k.view.level));
        const toStar = MASTERY_BAND_SIZE - (s.view.level % MASTERY_BAND_SIZE);
        return (
          <Card
            key={s.id}
            variant="plain"
            accessibilityLabel={nextId ? `Continue ${s.name}` : s.name}
            onPress={nextId ? () => startLevel(nextId) : undefined}
            style={{ padding: space.xl, gap: space.lg }}>
            <Row gap={space.lg}>
              <Emblem value={s.view.level} tone={s.view.stars > 0 ? 'mastery' : 'brand'} />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Eyebrow>
                  {subjectName(s.subjectId)} · Rank {rank}
                </Eyebrow>
                <Title>{s.name}</Title>
                <Caption>
                  Lv. {s.view.level} / {s.view.band * MASTERY_BAND_SIZE}
                </Caption>
              </View>
              <Stars count={s.view.stars} />
              <LevelArt art={levelByNumber(s.id, s.view.nextLevel)?.art ?? levelByNumber(s.id, Math.max(s.view.level, 1))?.art} size={64} />
            </Row>
            <View style={{ gap: space.xs }}>
              <Eyebrow>
                Chapter {s.view.chapter} · Levels {chapterStart}–{chapterStart + 9}
              </Eyebrow>
              <ChapterRail start={chapterStart} level={s.view.level} next={s.view.nextLevel} />
            </View>
            <View style={{ gap: space.xs }}>
              <ProgressBar value={s.view.bandProgress} size="sm" />
              <Caption>
                {toStar} {toStar === 1 ? 'level' : 'levels'} to ★ Mastery · {published} levels available
              </Caption>
            </View>
          </Card>
        );
      })}

      {upcoming.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Coming soon</Eyebrow>
          {upcoming.map((s) => (
            <Row key={s.id} style={{ justifyContent: 'space-between', paddingVertical: space.sm }}>
              <Caption>{s.name}</Caption>
              <Chip>
                <Caption>Soon</Caption>
              </Chip>
            </Row>
          ))}
        </View>
      )}
    </Screen>
  );
}
