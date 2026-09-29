import { View } from 'react-native';
import { AccountCard } from '@/components/AccountCard';
import { AttributeRow, SubjectRing, type SubjectStat } from '@/components/CharacterSheet';
import { DeleteAccount } from '@/components/DeleteAccount';
import { FeedbackSettings } from '@/components/FeedbackSettings';
import { ReminderSettings } from '@/components/ReminderSettings';
import { UnlimitedCard } from '@/components/UnlimitedCard';
import { Button, Caption, Card, Chip, Eyebrow, H1, Icon, LevelArt, OfflineState, Row, Screen, StatTile } from '@/components/ui';
import { questDef, useQuests } from '@/progress/useQuests';
import { subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

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
  const trophies = useQuests().data?.trophies ?? [];
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
        <H1>{name}</H1>
        <Chip>
          <Caption>No title yet</Caption>
        </Chip>
      </View>

      <Row gap={space.sm}>
        <StatTile label="Total XP" value={v.totalXp} tone="brand" icon="xp" />
        <StatTile label="Skills" value={v.skills.filter((s) => s.view.level > 0).length} icon="skills" />
        <StatTile label="Stars" value={stars} tone={stars > 0 ? 'mastery' : 'text'} icon="star" />
      </Row>
      <Row gap={space.sm}>
        <StatTile label="Streak" value={`${v.streak.current} ${v.streak.current === 1 ? 'day' : 'days'}`} tone={v.streak.today ? 'streak' : 'text'} icon="flame" />
        <StatTile label="Longest" value={`${v.streak.longest} ${v.streak.longest === 1 ? 'day' : 'days'}`} icon="flame" />
      </Row>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Trophies</Eyebrow>
        <View
          style={{ flexDirection: 'row', gap: space.sm }}
          accessible
          accessibilityLabel={trophies.length ? `Trophies: ${trophies.map((t) => t.name).join(', ')}` : 'Trophies: none yet. Finish a weekly quest in its week to earn one.'}>
          {[0, 1, 2].map((i) => {
            const t = trophies[i];
            const art = t ? questDef(t.questId)?.art : undefined;
            return t ? (
              <View key={t.trophyId} style={{ flex: 1, aspectRatio: 1, gap: space.xs, borderRadius: radius.lg, borderWidth: depth.border, borderColor: color.brandLine, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', padding: space.xs }}>
                {art ? <LevelArt art={art} size={56} /> : <Icon name="trophy" tint={color.brandText} size={iconSize.xl} />}
                <Caption center numberOfLines={2}>
                  {t.name}
                </Caption>
              </View>
            ) : (
              <View key={i} style={{ flex: 1, aspectRatio: 1, gap: space.xs, borderRadius: radius.lg, borderWidth: depth.border, borderStyle: 'dashed', borderColor: color.border, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trophy" tint={color.borderStrong} size={iconSize.xl} />
                <Caption tone="faint">Empty</Caption>
              </View>
            );
          })}
        </View>
        {trophies.length === 0 && <Caption>Finish a weekly quest in its week to earn its trophy.</Caption>}
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
