import { trophiesAhead } from '@brainscroll/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AttributeRow, SubjectRing, type SubjectStat } from '@/components/CharacterSheet';
import { Button, Caption, Card, Chip, Eyebrow, H1, LevelArt, OfflineState, Row, Screen, StatTile } from '@/components/ui';
import { TrophyBadge } from '@/components/TrophyBadge';
import { questDef, useQuests } from '@/progress/useQuests';
import { subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * The character sheet: "this is the character I've built by learning", not
 * account statistics. Knowledge Level up front, subject ranks and named skills
 * with exact levels and ★, and empty-but-honest slots where titles and trophies
 * will live (earned from transparent requirements, never bought).
 */
export default function ProfileScreen() {
  const p = useProgress();
  const { account } = p;
  const v = useProgressView();
  const questData = useQuests().data;
  const trophies = questData?.trophies ?? [];
  const next = trophiesAhead(trophies.map((t) => t.trophyId));
  const title = questData?.equipped.titleQuestId ? questDef(questData.equipped.titleQuestId) : undefined;
  const emblem = questData?.equipped.emblemQuestId ? questDef(questData.equipped.emblemQuestId) : undefined;
  const name = account?.status !== 'signed_in' ? 'Learner' : account.email && !account.email.endsWith('privaterelay.appleid.com') ? capitalize(account.email.split('@')[0]) : 'Learner';
  // Every subject is an attribute, even before its first skill ships.
  const stats: SubjectStat[] = subjects.map((sub) => {
    const skills = v.skills.filter((s) => s.subjectId === sub.id);
    return {
      subjectId: sub.id,
      name: sub.name,
      levels: skills.reduce((n, s) => n + s.view.level, 0),
      soon: skills.length === 0,
    };
  });
  const stars = v.skills.reduce((n, s) => n + s.view.stars, 0);

  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;
  return (
    <Screen>
      <Eyebrow tone="brand">Everything you know</Eyebrow>
      <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.sm, paddingBottom: space.lg }}>
        <SubjectRing stats={stats} knowledge={v.knowledgeLevel} />
        <Row gap={space.sm}>
          {emblem ? <LevelArt art={emblem.art} size={40} /> : null}
          <H1>{name}</H1>
        </Row>
        <Chip tone={title ? 'brand' : 'muted'}>
          <Caption>{title ? title.titleReward : 'No title yet'}</Caption>
        </Chip>
      </View>

      <Row gap={space.sm}>
        <StatTile label="Total XP" value={v.totalXp} tone="brand" icon="xp" />
        <StatTile label="Skills" value={v.skills.filter((s) => s.view.level > 0).length} icon="skills" />
        <StatTile label="Stars" value={stars} tone={stars > 0 ? 'mastery' : 'text'} icon="star" art={stars > 0 ? 'mastery-star' : undefined} />
      </Row>
      <Pressable accessibilityRole="button" accessibilityLabel={`Learning streak: ${v.streak.current} days, longest ${v.streak.longest}. Open`} onPress={() => router.push('/streak')}>
      <Row gap={space.sm}>
        <StatTile label="Streak" value={`${v.streak.current} ${v.streak.current === 1 ? 'day' : 'days'}`} tone={v.streak.today ? 'streak' : 'text'} art={v.streak.current > 0 && !v.streak.today ? 'streak-ember' : 'streak-flame'} />
        <StatTile label="Longest" value={`${v.streak.longest} ${v.streak.longest === 1 ? 'day' : 'days'}`} art="streak-flame" />
      </Row>
      </Pressable>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Trophies</Eyebrow>
        {/* Each earned trophy opens its share card. */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[0, 1, 2].map((i) => {
            const t = trophies[i];
            return t ? (
              <Pressable
                key={t.trophyId}
                accessibilityRole="button"
                accessibilityLabel={`Trophy: ${t.name}. Share`}
                onPress={() => router.push({ pathname: '/share/[id]', params: { id: t.trophyId } })}
                style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}>
                <TrophyBadge trophy={t} name={t.name} />
              </Pressable>
            ) : next[i - trophies.length] ? (
              // An open slot shows a trophy that could fill it, dimmed: something to aim at, not a blank.
              <Pressable
                key={next[i - trophies.length]!.id}
                accessibilityRole="button"
                accessibilityLabel={`${next[i - trophies.length]!.name}, not earned yet. Opens your trophies`}
                onPress={() => router.push('/trophies')}
                style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}>
                <TrophyBadge trophyId={next[i - trophies.length]!.id} name={next[i - trophies.length]!.name} locked />
              </Pressable>
            ) : (
              <View key={i} style={{ flex: 1 }}>
                <TrophyBadge name="" locked />
              </View>
            );
          })}
        </View>
        {trophies.length === 0 && <Caption>Your first level earns the first one. More come from milestones and weekly quests.</Caption>}
        <Button variant="ghost" label={trophies.length ? `See all trophies (${trophies.length})` : 'See all trophies'} onPress={() => router.push('/trophies')} />
      </View>

      <Card style={{ gap: space.xs }}>
        <Eyebrow>Subjects</Eyebrow>
        {[...stats.filter((st) => !st.soon), ...stats.filter((st) => st.soon)].map((st) => (
          <AttributeRow key={st.subjectId} stat={st} />
        ))}
      </Card>

      {/* Plan, sound, reminders and the account live in Settings. */}
      <Button variant="secondary" label="Settings" onPress={() => router.push('/settings')} />
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
