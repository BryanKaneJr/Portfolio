import { subjectRank } from '@brainscroll/core';
import { View } from 'react-native';
import { AccountCard } from '@/components/AccountCard';
import { DeleteAccount } from '@/components/DeleteAccount';
import { Button, Caption, Card, Chip, Emblem, Eyebrow, H1, Row, Screen, Stars, StatTile, Title } from '@/components/ui';
import { subjectName } from '@/content';
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
  const bySubject = [...new Set(v.skills.map((s) => s.subjectId))].map((subjectId) => {
    const skills = v.skills.filter((s) => s.subjectId === subjectId);
    return { subjectId, skills, rank: subjectRank(skills.map((s) => s.view.level)) };
  });
  const stars = v.skills.reduce((n, s) => n + s.view.stars, 0);

  return (
    <Screen>
      <Eyebrow tone="brand">Character sheet</Eyebrow>
      <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
        <Emblem value={v.knowledgeLevel} size="lg" glowing caption="Knowledge Level" />
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
            <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.border, alignItems: 'center', justifyContent: 'center' }}>
              <Caption tone="faint">Trophy slot</Caption>
            </View>
          ))}
        </Row>
        <Caption>Rare trophies you earn will show here. Earned from transparent requirements, never bought.</Caption>
      </View>

      {bySubject.map((g) => (
        <Card key={g.subjectId} style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Eyebrow>{subjectName(g.subjectId)}</Eyebrow>
            <Chip tone="brand">
              <Caption tone="text">Rank {g.rank}</Caption>
            </Chip>
          </Row>
          {g.skills.map((s) => (
            <Row key={s.id} style={{ justifyContent: 'space-between' }}>
              <Title>
                {s.name} Lv. {s.view.level}
              </Title>
              <Row>
                <Stars count={s.view.stars} />
                <Caption>{s.xp} XP</Caption>
              </Row>
            </Row>
          ))}
        </Card>
      ))}

      <AccountCard />
      <DeleteAccount />
      {__DEV__ && <Button variant="ghost" label="Reset progress (dev)" onPress={() => void resetAll()} />}
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
