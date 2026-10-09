import { clearedChapters, XP } from '@brainscroll/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Body, Caption, Card, Chip, Eyebrow, Icon, Row, Title } from '@/components/ui';
import { chaptersFor, levelCount, skills } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, iconSize, space } from '@/theme/tokens';

/**
 * Practice's last part: go back over any chapter you've cleared,
 * whenever you like. One question per level, up to XP.CHAPTER_REVIEW_MAX each
 * time. Once a skill has nothing new left for the learner, its chapter
 * reviews count toward Weekly Quests, and the skill says so.
 */
export function ChapterReviews() {
  const { snapshot } = useProgress();
  const cleared = skills
    .map((s) => ({ skill: s, highest: snapshot.skills[s.id]?.highestCleared ?? 0 }))
    .filter((x) => clearedChapters(x.highest) > 0);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Eyebrow>Go back over a chapter</Eyebrow>
        <Caption>{`One question from each level. Up to +${XP.CHAPTER_REVIEW_MAX} XP each time.`}</Caption>
      </View>
      {cleared.length === 0 ? (
        <Card variant="quiet">
          <Body muted>Clear a chapter (ten levels) and you can come back to it here, any time.</Body>
        </Card>
      ) : (
        cleared.map(({ skill, highest }) => {
          const titles = chaptersFor(skill.id);
          const n = clearedChapters(highest);
          const nothingNew = highest >= levelCount(skill.id);
          return (
            <Card key={skill.id} style={{ gap: space.md }}>
              <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                <Title style={{ flexShrink: 1 }}>{skill.name}</Title>
                {nothingNew && (
                  <Chip tone="brand" icon="flag">
                    <Caption tone="text">Counts toward quests</Caption>
                  </Chip>
                )}
              </Row>
              {Array.from({ length: n }, (_, i) => i + 1).map((chapter) => {
                const title = titles.find((c) => c.number === chapter)?.title;
                const label = title ? `Chapter ${chapter}: ${title}` : `Chapter ${chapter}`;
                return (
                  <Card
                    key={chapter}
                    variant="quiet"
                    accessibilityLabel={`Review ${skill.name}, ${label}`}
                    onPress={() => router.push({ pathname: '/chapter-review', params: { skill: skill.id, chapter: String(chapter) } })}
                    style={{ paddingVertical: space.md }}>
                    <Row gap={space.md}>
                      <Body style={{ flex: 1 }}>{label}</Body>
                      <Icon name="forward" tint={color.textFaint} size={iconSize.sm} />
                    </Row>
                  </Card>
                );
              })}
            </Card>
          );
        })
      )}
    </View>
  );
}
