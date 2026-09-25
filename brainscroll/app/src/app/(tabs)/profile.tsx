import { View } from 'react-native';
import { AccountCard } from '@/components/AccountCard';
import { AttributeRow, SubjectRing, type SubjectStat } from '@/components/CharacterSheet';
import { DeleteAccount } from '@/components/DeleteAccount';
import { Button, Caption, Card, Chip, Eyebrow, H1, Icon, Row, Screen, StatTile } from '@/components/ui';
import { subjects } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { color, radius, space } from '@/theme/tokens';

/**
 * The character sheet: "this is the character I've built by learning", not
 * account statistics. Knowledge Level up front, subject ranks and named skills
 * with exact levels and ★, and empty-but-honest slots where titles and trophies
 * will live (earned from transparent requirements, never bought).
 */
export default function ProfileScreen() {
  const { resetAll, account } = useProgress();
  const v = useProgressView();
  const name = account?.status !== 'signed_in' ? 'Learner' : account.email && !account.email.endsWith('privaterelay.appleid.com') ? capitalize(account.email.split('@')[0]) : 'Learner';
  // Every subject is an attribute, even before its first skill ships.
  const stats: (SubjectStat & { detail?: string })[] = subjects.map((sub) => {
    const skills = v.skills.filter((s) => s.subjectId === sub.id);
    return {
      subjectId: sub.id,
      name: sub.name,
      levels: skills.reduce((n, s) => n + s.view.level, 0),
      soon: skills.length === 0,
      detail: skills.length ? skills.map((s) => `${s.name} Lv. ${s.view.level}${s.view.stars ? ` ${'★'.repeat(s.view.stars)}` : ''}`).join('  ·  ') : undefined,
    };
  });
  const stars = v.skills.reduce((n, s) => n + s.view.stars, 0);

  return (
    <Screen>
      <Eyebrow tone="brand">Character sheet</Eyebrow>
      <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.sm, paddingBottom: space.lg }}>
        <SubjectRing stats={stats} knowledge={v.knowledgeLevel} />
        <H1>{name}</H1>
        <Chip>
          <Caption>No title equipped yet</Caption>
        </Chip>
      </View>

      <Row gap={space.sm}>
        <StatTile label="Total XP" value={v.totalXp} tone="brand" icon="xp" />
        <StatTile label="Skills" value={v.skills.filter((s) => s.view.level > 0).length} icon="skills" />
        <StatTile label="Stars" value={stars} tone={stars > 0 ? 'mastery' : 'text'} icon="star" />
      </Row>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Showcase</Eyebrow>
        <Row gap={space.sm}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, aspectRatio: 1, gap: space.xs, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: color.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trophy" tint={color.borderStrong} size={34} />
              <Caption tone="faint">Empty</Caption>
            </View>
          ))}
        </Row>
      </View>

      <Card style={{ gap: space.xs }}>
        <Eyebrow>Attributes</Eyebrow>
        {[...stats.filter((st) => !st.soon), ...stats.filter((st) => st.soon)].map((st) => (
          <AttributeRow key={st.subjectId} stat={st} detail={st.detail} />
        ))}
      </Card>

      <AccountCard />
      <DeleteAccount />
      {__DEV__ && <Button variant="ghost" label="Reset progress (dev)" onPress={() => void resetAll()} />}
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
