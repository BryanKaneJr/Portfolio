import { compareSubjects, rarestTrophies, trophyInfo, type SocialProfile } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/social';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Body, Button, GradientFill, Caption, Card, Emblem, Eyebrow, H1, IconButton, Notice, Numeral, Row, Screen, SkeletonCard, StateBlock, Title } from '@/components/ui';
import { skills, subjects, trophyCatalog } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { lift } from '@/theme/subjectTheme';
import { color, radius, space } from '@/theme/tokens';

/**
 * A friend's or league mate's profile (owner, 2026-10-01): their brain at a
 * glance, their three rarest trophies, then every subject side by side with
 * yours: what you're better in and what they're better in. Block and report
 * are always one tap away.
 */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProgress();
  const [them, setThem] = useState<SocialProfile | null>(null);
  const [you, setYou] = useState<SocialProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'report' | 'remove' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { social, account } = p;
  const myId = account?.status === 'signed_in' ? account.userId : undefined;
  const load = useCallback(() => {
    if (!id) return;
    Promise.all([social.profile(id), myId && myId !== id ? social.profile(myId) : Promise.resolve(null)]).then(
      ([t, y]) => {
        setThem(t);
        setYou(y);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [id, myId, social]);
  useEffect(load, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/social'));
  if (failed)
    return <StateBlock layout="screen" spot="not-found" title="You can’t see this profile." body="Profiles are for friends and league mates." secondary={{ label: 'Back', onPress: back }} />;
  if (!them)
    return (
      <Screen header={<IconButton label="Back" icon="back" onPress={back} />}>
        <SkeletonCard art={72} lines={4} />
      </Screen>
    );

  const act = (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNotice(null);
    fn()
      .then(() => {
        if (done) setNotice(done);
        setConfirm(null);
        load();
      })
      .catch(() => setNotice('That didn’t work. Try again.'))
      .finally(() => setBusy(false));
  };

  const rarest = rarestTrophies(them.trophies);
  const rows = you ? compareSubjects(you.skills, them.skills, skills, subjects).filter((r) => r.you > 0 || r.them > 0) : [];
  const isYou = them.relation === 'you';

  return (
    <Screen header={<IconButton label="Back" icon="back" onPress={back} />}>
      <Row gap={space.lg}>
        {them.relation === 'you' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Your avatar. Change it" onPress={() => router.push('/avatar')}>
            <Avatar username={them.username} avatar={them.avatar} size={72} />
          </Pressable>
        ) : (
          <Avatar username={them.username} avatar={them.avatar} size={72} />
        )}
        <View style={{ flex: 1, gap: space.xxs }}>
          <Eyebrow tone="brand">{isYou ? 'You' : them.relation === 'friend' ? 'Friend' : them.relation === 'league' ? 'In your league' : 'Learner'}</Eyebrow>
          <H1 numberOfLines={1}>{`@${them.username}`}</H1>
        </View>
      </Row>

      {!isYou && (
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {them.relation === 'friend' ? (
            <Button compact variant="secondary" label="Friends ✓" onPress={() => setConfirm('remove')} />
          ) : them.relation === 'requested' ? (
            <Button compact variant="secondary" label="Requested" disabled />
          ) : them.relation === 'asked_you' ? (
            <Button compact label="Accept friend request" loading={busy} onPress={() => act(() => social.respondFriendRequest(them.id, true))} />
          ) : (
            <Button compact label="Add friend" loading={busy} onPress={() => act(() => social.sendFriendRequest(them.id), 'Request sent.')} />
          )}
          <Button compact variant="ghost" label="Block" onPress={() => setConfirm('block')} />
          <Button compact variant="ghost" label="Report" onPress={() => setConfirm('report')} />
        </Row>
      )}
      {confirm && (
        <Card variant="raised" style={{ gap: space.sm }}>
          <Body>
            {confirm === 'block'
              ? `Block @${them.username}? You won’t see each other in Social, and you’ll stop being friends.`
              : confirm === 'remove'
                ? `Remove @${them.username} from your friends?`
                : `Report @${them.username}'s username or activity to the BrainScroll team?`}
          </Body>
          <Row gap={space.sm}>
            <Button
              compact
              label={confirm === 'block' ? 'Block' : confirm === 'remove' ? 'Remove' : 'Report'}
              loading={busy}
              onPress={() =>
                confirm === 'block'
                  ? act(() => social.blockUser(them.id).then(back))
                  : confirm === 'remove'
                    ? act(() => social.removeFriend(them.id))
                    : act(() => social.reportUser(them.id, 'other'), 'Thanks. We’ll take a look.')
              }
            />
            <Button compact variant="secondary" label="Cancel" onPress={() => setConfirm(null)} />
          </Row>
        </Card>
      )}
      {notice && <Notice tone="muted">{notice}</Notice>}

      <Card variant="plain" style={{ gap: space.md }}>
        <Eyebrow>Brain overview</Eyebrow>
        <Row gap={space.lg}>
          <Emblem value={them.knowledgeLevel} caption="Brain" />
          <View style={{ flex: 1, gap: space.xs }}>
            <Row gap={space.lg}>
              <View>
                <Numeral>{them.totalXp.toLocaleString('en-US')}</Numeral>
                <Caption>Total XP</Caption>
              </View>
              <View>
                <Numeral>{them.weeklyXp.toLocaleString('en-US')}</Numeral>
                <Caption>This week</Caption>
              </View>
            </Row>
            <Caption>{`Streak ${them.streak.current} ${them.streak.current === 1 ? 'day' : 'days'} · best ${them.streak.longest}`}</Caption>
          </View>
        </Row>
      </Card>

      <View style={{ gap: space.sm }}>
        <Title>Rarest trophies</Title>
        {rarest.length === 0 ? (
          <Caption>No trophies yet.</Caption>
        ) : (
          <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
            {rarest.map((t) => (
              <View key={t.trophyId} style={{ flex: 1, alignItems: 'center', gap: space.xs }}>
                <TrophyBadge trophyId={t.trophyId} name="" size={64} />
                <Caption center numberOfLines={2}>
                  {trophyInfo(t.trophyId, trophyCatalog)?.name ?? 'Trophy'}
                </Caption>
              </View>
            ))}
            {Array.from({ length: 3 - rarest.length }, (_, i) => (
              <View key={`gap-${i}`} style={{ flex: 1 }} />
            ))}
          </Row>
        )}
      </View>

      {!isYou && you && (
        <View style={{ gap: space.sm }}>
          <Title>You and them</Title>
          {rows.length === 0 ? (
            <Caption>Neither of you has cleared a level yet.</Caption>
          ) : (
            // Split down the middle (owner, 2026-10-01): you on the left, them on the right, each
            // subject's bars growing out from the centre line, so who leads reads at a glance.
            <Card variant="plain" style={{ gap: space.md }}>
              <Row>
                <Eyebrow tone="brand" style={{ flex: 1 }}>
                  You
                </Eyebrow>
                <Eyebrow style={{ flex: 1, textAlign: 'right' }}>{`@${them.username}`}</Eyebrow>
              </Row>
              {rows.map((r) => {
                // Full at 100 levels; past that the scale steps to 200, 300... (owner, 2026-10-01).
                const scale = Math.max(100, Math.ceil(Math.max(r.you, r.them) / 100) * 100);
                const youLead = r.you > r.them;
                const themLead = r.them > r.you;
                return (
                  <View key={r.subjectId} style={{ gap: space.xs }} accessible accessibilityLabel={`${r.name}: you ${r.you} levels, them ${r.them}${youLead ? ', you lead' : themLead ? ', they lead' : ', tied'}`}>
                    <Body center>{r.name}</Body>
                    <Row gap={space.xs}>
                      <Body style={{ width: 36, ...(youLead ? { fontWeight: '800', color: color.success } : themLead ? { color: color.danger } : { color: color.textMuted }) }}>{String(r.you)}</Body>
                      <CompareBar value={r.you} scale={scale} tone={youLead ? 'ahead' : themLead ? 'behind' : 'tied'} toward="left" />
                      <View style={styles.middle} />
                      <CompareBar value={r.them} scale={scale} tone={themLead ? 'ahead' : youLead ? 'behind' : 'tied'} toward="right" />
                      <Body style={{ width: 36, textAlign: 'right', ...(themLead ? { fontWeight: '800', color: color.success } : youLead ? { color: color.danger } : { color: color.textMuted }) }}>{String(r.them)}</Body>
                    </Row>
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}

/**
 * One side of a subject's comparison: green when that side leads, coral when
 * it trails, violet when tied, lit toward its tip like the app's progress bars.
 */
function CompareBar({ value, scale, tone, toward }: { value: number; scale: number; tone: 'ahead' | 'behind' | 'tied'; toward: 'left' | 'right' }) {
  const base = tone === 'ahead' ? color.success : tone === 'behind' ? color.danger : color.brand;
  // Anything above zero stays visible, however small next to the scale.
  const pct = value > 0 ? Math.max(4, (100 * value) / scale) : 0;
  return (
    <View style={styles.track}>
      {pct > 0 && (
        <View style={[styles.fill, { width: `${pct}%`, alignSelf: toward === 'left' ? 'flex-end' : 'flex-start', opacity: tone === 'behind' ? 0.85 : 1 }]}>
          <GradientFill horizontal from={toward === 'left' ? lift(base, 0.3) : base} to={toward === 'left' ? base : lift(base, 0.3)} rx={6} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', minWidth: 12, borderRadius: radius.pill, overflow: 'hidden' },
  middle: { width: 2, height: 20, backgroundColor: color.borderStrong, borderRadius: 1 },
});
