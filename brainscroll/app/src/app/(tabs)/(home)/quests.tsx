import { router } from 'expo-router';
import { View } from 'react-native';
import { Body, Caption, Card, Eyebrow, IconButton, LevelArt, LoadError, Loading, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { isPast, questDef, questTotals, useQuests } from '@/progress/useQuests';
import { space } from '@/theme/tokens';

/**
 * The Archive: every past Weekly Quest, still completable for the knowledge
 * and the XP. Trophies were for the live week. One Archive quest at a time.
 */
export default function ArchiveScreen() {
  const { data, failed, reload } = useQuests();
  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>Weekly quests</Eyebrow>
        <Title>The Archive</Title>
      </View>
    </Row>
  );
  if (failed) return <LoadError layout="screen" onRetry={() => void reload()} onBack={() => router.back()} />;
  if (!data)
    return (
      <Screen header={header}>
        <Loading label="Loading the Archive">
          <SkeletonCard art={48} lines={1} />
          <SkeletonCard art={48} lines={1} />
        </Loading>
      </Screen>
    );
  const past = data.quests.filter(isPast);
  return (
    <Screen header={header}>
      <Body muted>Past weeks’ quests stay open. Finishing one now earns its XP; the trophy was for its week. Work on one at a time.</Body>
      {past.length === 0 && <Caption>Nothing here yet. Quests arrive in the Archive when their week ends.</Caption>}
      {past.map((q) => {
        const def = questDef(q.id);
        if (!def) return null;
        const { done, required } = questTotals(q);
        const status =
          q.state === 'completed' ? (q.liveClear ? 'Finished in its week · Trophy' : 'Finished · XP earned') : q.active ? `In progress · ${done} / ${required}` : 'Not started';
        return (
          <Card
            key={q.id}
            variant="plain"
            accessibilityLabel={`${def.title}: ${status}. Open the quest.`}
            onPress={() => router.push({ pathname: '/quest/[id]', params: { id: q.id } })}
            state={q.state === 'completed' ? 'completed' : undefined}
            style={{ paddingVertical: space.md }}>
            <Row gap={space.md}>
              <LevelArt art={def.art} size={48} />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Body>{def.title}</Body>
                <Caption>{status}</Caption>
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
