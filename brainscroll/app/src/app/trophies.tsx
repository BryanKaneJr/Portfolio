import { MILESTONE_TROPHIES } from '@brainscroll/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Body, Caption, Eyebrow, IconButton, LoadError, Loading, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { useQuests } from '@/progress/useQuests';
import { space } from '@/theme/tokens';

/**
 * The trophy room: everything earned (quest trophies and milestones, newest
 * first), then the milestones still ahead with what each asks for. Quest
 * trophies can't be listed ahead: they belong to their week.
 */
export default function TrophiesScreen() {
  const { data, failed, reload } = useQuests();
  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/profile'))} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>Everything you know</Eyebrow>
        <Title>Trophies</Title>
      </View>
    </Row>
  );
  if (failed) return <LoadError layout="screen" onRetry={() => void reload()} onBack={() => router.back()} />;
  if (!data)
    return (
      <Screen header={header}>
        <Loading label="Loading your trophies">
          <SkeletonCard lines={2} />
        </Loading>
      </Screen>
    );
  const earned = data.trophies;
  const ahead = MILESTONE_TROPHIES.filter((m) => !earned.some((t) => t.trophyId === m.id));
  const rows = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / 3) }, (_, i) => items.slice(i * 3, i * 3 + 3));
  return (
    <Screen header={header}>
      <Eyebrow>Earned ({earned.length})</Eyebrow>
      {earned.length === 0 && <Caption>None yet. Your first level earns the first one.</Caption>}
      {rows(earned).map((row, i) => (
        <Row key={i} gap={space.sm}>
          {row.map((t) => (
            <TrophyBadge key={t.trophyId} trophy={t} name={t.name} />
          ))}
          {Array.from({ length: 3 - row.length }, (_, k) => (
            <View key={k} style={{ flex: 1 }} />
          ))}
        </Row>
      ))}
      {ahead.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Still ahead</Eyebrow>
          {ahead.map((m) => (
            <Row key={m.id} gap={space.md} style={{ paddingVertical: space.xs }}>
              <View style={{ width: 72 }}>
                <TrophyBadge name="" locked />
              </View>
              <View style={{ flex: 1, gap: space.xxs }}>
                <Body>{m.name}</Body>
                <Caption>{m.description}</Caption>
              </View>
            </Row>
          ))}
        </View>
      )}
      <Caption>Weekly quest trophies are for finishing a quest in its week.</Caption>
    </Screen>
  );
}
