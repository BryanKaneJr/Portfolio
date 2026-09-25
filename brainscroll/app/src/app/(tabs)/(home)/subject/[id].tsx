import { MASTERY_BAND_SIZE, subjectAttribute, type MascotPose } from '@brainscroll/core';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Caption, Card, DrScroll, Emblem, Eyebrow, IconButton, LevelArt, ProgressBar, Row, Screen, Stars, Title } from '@/components/ui';
import { chapterFor, levelByNumber, subjectName } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { color, space, subjectColor } from '@/theme/tokens';

/** Dr. Scroll's pose for each subject's region. */
const SUBJECT_POSE: Record<string, MascotPose> = {
  'subject.history': 'history',
  'subject.science': 'science',
  'subject.geography': 'geography',
  'subject.money': 'money',
  'subject.arts': 'arts',
  'subject.world_systems': 'world-systems',
};

/**
 * A subject's region, between the World Map and a skill's map, for subjects
 * with more than one skill: pick where to go. Each skill shows its art, level
 * and the chapter you're in.
 */
export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const { skills } = useProgressView();
  if (!p.ready) return <Screen>{null}</Screen>;
  const mine = skills.filter((k) => k.subjectId === id);
  if (!id || mine.length === 0) return <Redirect href="/" />;
  const attr = subjectAttribute(mine.reduce((n, k) => n + k.view.level, 0));
  const mastered = attr.stars > 0;

  return (
    <Screen
      header={
        <Row gap={space.sm}>
          <IconButton label="World map" icon="back" onPress={() => router.navigate('/')} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow tone={mastered ? 'mastery' : 'muted'}>Region</Eyebrow>
            <Title style={mastered ? { color: color.mastery } : undefined}>
              {subjectName(id)}
              {mastered ? ` ${'★'.repeat(Math.min(attr.stars, 3))}` : ''} · Lv. {attr.level}
            </Title>
          </View>
        </Row>
      }>
      <View style={{ alignItems: 'center' }}>
        <DrScroll pose={SUBJECT_POSE[id] ?? 'reading'} size="md" />
      </View>
      {mine.map((s) => {
        const art = levelByNumber(s.id, s.view.nextLevel)?.art ?? levelByNumber(s.id, Math.max(s.view.level, 1))?.art;
        const chapter = chapterFor(s.id, s.view.nextLevel);
        return (
          <Card
            key={s.id}
            variant="plain"
            accessibilityLabel={`Open ${s.name}`}
            onPress={() => router.push({ pathname: '/skill/[id]', params: { id: s.id } })}
            style={{ gap: space.md, borderColor: subjectColor[id] ?? color.border }}>
            <Row gap={space.md}>
              <Emblem value={s.view.level} size="sm" tone={s.view.stars > 0 ? 'mastery' : 'brand'} />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Title>{s.name}</Title>
                <Caption>{chapter ? `Chapter ${chapter.number}: ${chapter.title}` : `Lv. ${s.view.level}`}</Caption>
              </View>
              <Stars count={s.view.stars} />
              <LevelArt art={art} size={56} />
            </Row>
            <ProgressBar value={(s.view.level % MASTERY_BAND_SIZE) / MASTERY_BAND_SIZE} size="sm" />
          </Card>
        );
      })}
    </Screen>
  );
}
