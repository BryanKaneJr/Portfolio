import { MASTERY_BAND_SIZE, subjectAttribute } from '@brainscroll/core';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Caption, Card, Chip, Emblem, Eyebrow, Icon, LevelArt, ProgressBar, Row, Screen, ScreenHeader, Stars, Title } from '@/components/ui';
import { levelByNumber, subjectName, subjects } from '@/content';
import { SUBJECT_ICON } from '@/components/CharacterSheet';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { ChapterRail } from '@/components/ChapterRail';
import { color, iconSize, layout, radius, space, type } from '@/theme/tokens';

/**
 * Skills you are leveling, not a course catalog. Each skill shows its level
 * emblem, subject, mastery stars, the active 10-level chapter and the
 * road to the next ★. Never 100 equal dots.
 */
export default function SkillsScreen() {
  const { setActiveSkill, activeSkillId } = useProgress();
  const { skills: all } = useProgressView();
  // The skill you're playing first, then others in progress (furthest along first), then untouched ones.
  const rank = (s: (typeof all)[number]) => (s.id === activeSkillId ? 0 : s.view.level > 0 ? 1 : 2);
  const sorted = [...all].sort((a, b) => rank(a) - rank(b) || b.view.level - a.view.level);
  // Full cards for the skills you're leveling; untouched ones are a compact list by subject,
  // so 26 trees don't turn the tab into a catalog.
  const skills = sorted.filter((s) => rank(s) < 2);
  const fresh = sorted.filter((s) => rank(s) === 2);
  const open = (id: string) => {
    setActiveSkill(id);
    router.navigate({ pathname: '/skill/[id]', params: { id } });
  };
  const upcoming = subjects.filter((s) => !all.some((k) => k.subjectId === s.id));

  return (
    <Screen>
      <ScreenHeader eyebrow="Your build" title="Skills" />
      {skills.map((s) => {
        const chapterStart = (s.view.band - 1) * MASTERY_BAND_SIZE + (s.view.chapter - 1) * 10 + 1;
        const subject = subjectAttribute(all.filter((k) => k.subjectId === s.subjectId).reduce((n, k) => n + k.view.level, 0));
        const toStar = MASTERY_BAND_SIZE - (s.view.level % MASTERY_BAND_SIZE);
        return (
          <Card
            key={s.id}
            variant="plain"
            accessibilityLabel={`Open ${s.name}, level ${s.view.level}${s.view.stars ? `, ${s.view.stars} mastery ${s.view.stars === 1 ? 'star' : 'stars'}` : ''}, ${toStar} ${toStar === 1 ? 'level' : 'levels'} to the next mastery star`}
            onPress={() => open(s.id)}
            style={{ padding: space.xl, gap: space.lg }}>
            <Row gap={space.lg}>
              <Emblem value={s.view.level} tone={s.view.stars > 0 ? 'mastery' : 'brand'} />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Eyebrow tone={subject.stars ? 'mastery' : 'muted'}>
                  {subjectName(s.subjectId)}
                  {subject.stars ? ` ${'★'.repeat(Math.min(subject.stars, 5))}` : ''}
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
                {toStar} {toStar === 1 ? 'level' : 'levels'} to ★ Mastery
              </Caption>
            </View>
            {/* A visible cue that the whole card opens the map (UX review C6). */}
            <Row gap={space.xs} style={{ justifyContent: 'flex-end' }}>
              <Text style={[type.label, { color: color.brandText }]}>View skill map</Text>
              <Icon name="forward" tint={color.brandText} size={iconSize.md} />
            </Row>
          </Card>
        );
      })}

      {fresh.length > 0 && (
        <View style={{ gap: space.md }}>
          <Title>{skills.length ? 'Start something new' : 'Pick a skill'}</Title>
          {subjects
            .filter((sub) => fresh.some((k) => k.subjectId === sub.id))
            .map((sub) => (
              <View key={sub.id} style={{ gap: space.sm }}>
                <Eyebrow>{sub.name}</Eyebrow>
                {fresh
                  .filter((k) => k.subjectId === sub.id)
                  .map((k) => (
                    <Card key={k.id} variant="plain" accessibilityLabel={`Open ${k.name}, not started`} onPress={() => open(k.id)} style={{ paddingVertical: space.md, paddingHorizontal: space.lg }}>
                      <Row gap={space.md}>
                        <LevelArt art={levelByNumber(k.id, 1)?.art} size={40} />
                        <Body style={{ flex: 1 }}>{k.name}</Body>
                        <Icon name="forward" tint={color.textMuted} size={iconSize.md} />
                      </Row>
                    </Card>
                  ))}
              </View>
            ))}
        </View>
      )}

      {upcoming.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Coming soon</Eyebrow>
          {upcoming.map((s) => (
            <Row key={s.id} gap={space.md} style={{ paddingVertical: space.sm }}>
              <View style={{ width: layout.iconPlate, height: layout.iconPlate, borderRadius: radius.md, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={SUBJECT_ICON[s.id] ?? 'book'} tint={color.textMuted} size={iconSize.lg} />
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

