import type { QuestView } from '@brainscroll/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Caption, Card, Eyebrow, Gleams, LevelArt, ProgressBar, Row, Title } from '@/components/ui';
import { questDef, questStatusLine, questTotals } from '@/progress/useQuests';
import { space } from '@/theme/tokens';

/** Home's Weekly Quest card: this week's quest (or your active Archive quest) and where it stands. */
export function QuestCard({ quest }: { quest: QuestView }) {
  const def = questDef(quest.id);
  if (!def) return null;
  const { done, required } = questTotals(quest);
  const eyebrow = quest.state === 'archive' ? 'From the Archive' : 'This week’s quest';
  return (
    <Card
      variant="accent"
      accessibilityLabel={`${eyebrow}: ${def.title}, ${done} of ${required} levels. ${questStatusLine(quest)} Open the quest.`}
      onPress={() => router.push({ pathname: '/quest/[id]', params: { id: quest.id } })}
      style={{ gap: space.md }}>
      <Row gap={space.md}>
        <LevelArt art={def.art} size={64} />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Eyebrow tone="brand">{eyebrow}</Eyebrow>
          <Title>{def.title}</Title>
          <Caption>{questStatusLine(quest)}</Caption>
        </View>
      </Row>
      <View style={{ gap: space.xs }}>
        <ProgressBar value={required ? done / required : 0} size="sm" label={`${done} of ${required} levels`} />
        <Caption>
          {done} / {required} new levels
        </Caption>
      </View>
      <Gleams count={3} />
    </Card>
  );
}
