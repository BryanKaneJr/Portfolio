import { MILESTONE_TROPHIES } from '@brainscroll/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { TrophyBadge } from '@/components/TrophyBadge';
import { useState } from 'react';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { trophyCatalog } from '@/content';
import { questDef, useQuests } from '@/progress/useQuests';
import { Body, Button, Caption, Card, Eyebrow, IconButton, LoadError, Loading, Notice, Row, Screen, SkeletonCard, Title, UiArt } from '@/components/ui';
import { color, space } from '@/theme/tokens';

/**
 * The trophy room: everything earned (quest trophies and milestones, newest
 * first), then the milestones still ahead with what each asks for. Quest
 * trophies can't be listed ahead: they belong to their week.
 */
export default function TrophiesScreen() {
  const { data, failed, reload } = useQuests();
  const p = useProgress();
  const { skills } = useProgressView();
  const [error, setError] = useState<string | null>(null);
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
  // Titles and emblems come with quest trophies (live-week clears).
  const unlocked = earned.flatMap((t) => (t.kind === 'quest' && t.questId && questDef(t.questId) ? [questDef(t.questId)!] : []));
  const equip = (next: typeof data.equipped) => {
    setError(null);
    p.setEquipped(next).then(
      () => void reload(),
      () => setError('Couldn’t change that. Try again.'),
    );
  };
  const ahead = MILESTONE_TROPHIES.filter((m) => m.id !== 'trophy.master_of_all' && m.id !== 'trophy.jack_of_all_trades' && !earned.some((t) => t.trophyId === m.id));
  const total = skills.length;
  const at100 = skills.filter((s) => s.view.level >= 100).length;
  const at50 = skills.filter((s) => s.view.level >= 50).length;
  const masteredSkills = earned.filter((t) => t.kind === 'mastery').length;
  const masteredSubjects = earned.filter((t) => t.kind === 'subject').length;
  const rows = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / 3) }, (_, i) => items.slice(i * 3, i * 3 + 3));
  return (
    <Screen header={header}>
      {/* The two whole-catalog trophies lead the room: the greatest, and the widest. */}
      <Card style={{ gap: space.md, borderColor: color.mastery }}>
        <Eyebrow tone="mastery">The greatest trophies</Eyebrow>
        {[
          { id: 'trophy.master_of_all', name: 'Master of All', have: at100, what: 'Level 100' },
          { id: 'trophy.jack_of_all_trades', name: 'Jack of All Trades', have: at50, what: 'Level 50' },
        ].map((g) => {
          const got = earned.find((t) => t.trophyId === g.id);
          return (
            <Row key={g.id} gap={space.md}>
              <View style={{ width: 88 }}>
                <TrophyBadge trophy={got} trophyId={g.id} name="" locked={!got} size={64} />
              </View>
              <View style={{ flex: 1, gap: space.xxs }}>
                <Body>{g.name}</Body>
                <Caption>
                  {got ? 'Earned.' : `${g.what} in every skill: ${g.have} of ${total} so far.`}
                </Caption>
              </View>
            </Row>
          );
        })}
      </Card>
      <Eyebrow>Earned ({earned.length})</Eyebrow>
      {earned.length === 0 && (
        <Row gap={space.md}>
          <UiArt name="empty-box" size={48} />
          <Caption style={{ flex: 1 }}>None yet. Your first level earns the first one.</Caption>
        </Row>
      )}
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
      <Caption>
        Mastery: {masteredSkills} of {trophyCatalog.skills.length} skills and {masteredSubjects} of {trophyCatalog.subjects.length} subjects. Each skill’s Level 100 earns its own trophy, and a subject’s comes when every skill in it is mastered.
      </Caption>
      {ahead.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Still ahead</Eyebrow>
          {ahead.map((m) => (
            <Row key={m.id} gap={space.md} style={{ paddingVertical: space.xs }}>
              <View style={{ width: 72 }}>
                <TrophyBadge trophyId={m.id} name="" locked />
              </View>
              <View style={{ flex: 1, gap: space.xxs }}>
                <Body>{m.name}</Body>
                <Caption>{m.description}</Caption>
              </View>
            </Row>
          ))}
        </View>
      )}
      <Caption>Weekly quest trophies are for finishing a quest in its week. Each also unlocks that quest’s title and emblem.</Caption>
      {unlocked.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Your title</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <Button compact variant="secondary" label="None" selected={data.equipped.titleQuestId === null} onPress={() => equip({ ...data.equipped, titleQuestId: null })} />
            {unlocked.map((q) => (
              <Button key={q.id} compact variant="secondary" label={q.titleReward} selected={data.equipped.titleQuestId === q.id} onPress={() => equip({ ...data.equipped, titleQuestId: q.id })} />
            ))}
          </View>
          <Eyebrow>Your emblem</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <Button compact variant="secondary" label="None" selected={data.equipped.emblemQuestId === null} onPress={() => equip({ ...data.equipped, emblemQuestId: null })} />
            {unlocked.map((q) => (
              <Button key={q.id} compact variant="secondary" label={q.title} selected={data.equipped.emblemQuestId === q.id} onPress={() => equip({ ...data.equipped, emblemQuestId: q.id })} />
            ))}
          </View>
          {error && <Notice>{error}</Notice>}
        </View>
      )}
    </Screen>
  );
}
