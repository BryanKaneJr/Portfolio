import { MASTERY_BAND_SIZE, subjectAttribute } from '@brainscroll/core';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Caption, Card, Chip, Emblem, Eyebrow, Icon, LevelArt, ProgressBar, Row, Screen, ScreenHeader, Stars, Title } from '@/components/ui';
import { levelByNumber, levelsForSkill, subjectName, subjects } from '@/content';
import { SUBJECT_ICON } from '@/components/CharacterSheet';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { ChapterRail } from '@/components/ChapterRail';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Skills you are leveling, not a course catalog. Each skill shows its level
 * emblem, subject level, mastery stars, the active 10-level chapter and the
 * road to the next ★. Never 100 equal dots.
 */
export default function SkillsScreen() {
  const { setActiveSkill, activeSkillId } = useProgress();
  const { skills: all } = useProgressView();
  // The skill you're playing first, then others in progress (furthest along first), then untouched ones.
  const rank = (s: (typeof all)[number]) => (s.id === activeSkillId ? 0 : s.view.level > 0 ? 1 : 2);
  const skills = [...all].sort((a, b) => rank(a) - rank(b) || b.view.level - a.view.level);
  const upcoming = subjects.filter((s) => !skills.some((k) => k.subjectId === s.id));

  return (
    <Screen>
      <ScreenHeader eyebrow="Your build" title="Skills" />
      {skills.map((s) => {
        const chapterStart = (s.view.band - 1) * MASTERY_BAND_SIZE + (s.view.chapter - 1) * 10 + 1;
        const published = levelsForSkill(s.id).length;
        const subject = subjectAttribute(skills.filter((k) => k.subjectId === s.subjectId).reduce((n, k) => n + k.view.level, 0));
        const toStar = MASTERY_BAND_SIZE - (s.view.level % MASTERY_BAND_SIZE);
        return (
          <Card
            key={s.id}
            variant="plain"
            accessibilityLabel={`Open ${s.name}`}
            onPress={() => {
              setActiveSkill(s.id);
              router.navigate({ pathname: '/skill/[id]', params: { id: s.id } });
            }}
            style={{ padding: space.xl, gap: space.lg }}>
            <Row gap={space.lg}>
              <Emblem value={s.view.level} tone={s.view.stars > 0 ? 'mastery' : 'brand'} />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Eyebrow tone={subject.stars ? 'mastery' : 'muted'}>
                  {subjectName(s.subjectId)}
                  {subject.stars ? ` ${'★'.repeat(Math.min(subject.stars, 5))}` : ''} · Lv. {subject.level}
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
            {/* A visible cue that the whole card opens the map (UX review C6). */}
            <Row gap={space.xs} style={{ justifyContent: 'flex-end' }}>
              <Text style={[type.label, { color: color.brandText }]}>View skill map</Text>
              <Icon name="forward" tint={color.brandText} size={18} />
            </Row>
          </Card>
        );
      })}

      {upcoming.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Coming soon</Eyebrow>
          {upcoming.map((s) => (
            <Row key={s.id} gap={space.md} style={{ paddingVertical: space.sm }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={SUBJECT_ICON[s.id] ?? 'book'} tint={color.textMuted} size={22} />
              </View>
              <Body muted style={{ flex: 1 }}>
                {s.name}
              </Body>
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

