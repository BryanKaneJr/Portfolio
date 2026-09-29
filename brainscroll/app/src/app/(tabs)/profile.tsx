import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AccountCard } from '@/components/AccountCard';
import { AttributeRow, SubjectRing, type SubjectStat } from '@/components/CharacterSheet';
import { DeleteAccount } from '@/components/DeleteAccount';
import { FeedbackSettings } from '@/components/FeedbackSettings';
import { ReminderSettings } from '@/components/ReminderSettings';
import { UnlimitedCard } from '@/components/UnlimitedCard';
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
  const { resetAll, account } = p;
  const v = useProgressView();
  const questData = useQuests().data;
  const trophies = questData?.trophies ?? [];
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
            ) : (
              <TrophyBadge key={i} name="Empty" locked />
            );
          })}
        </View>
        {trophies.length === 0 && <Caption>Trophies come from milestones (your first level, a chapter, Level 50…) and from weekly quests finished in their week.</Caption>}
        <Button variant="ghost" label={trophies.length ? `See all trophies (${trophies.length})` : 'See all trophies'} onPress={() => router.push('/trophies')} />
      </View>

      <Card style={{ gap: space.xs }}>
        <Eyebrow>Subjects</Eyebrow>
        {[...stats.filter((st) => !st.soon), ...stats.filter((st) => st.soon)].map((st) => (
          <AttributeRow key={st.subjectId} stat={st} />
        ))}
      </Card>

      <UnlimitedCard />
      <FeedbackSettings />
      <ReminderSettings />
      <AccountCard />
      <DeleteAccount />
      {__DEV__ && <Button variant="ghost" label="Reset progress (dev)" onPress={() => void resetAll()} />}
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
