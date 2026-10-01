import { compareSubjects, rarestTrophies, trophyInfo, type SocialProfile } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/social';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Body, Button, Caption, Card, Emblem, Eyebrow, H1, IconButton, Notice, Numeral, ProgressBar, Row, Screen, SkeletonCard, StateBlock, Title } from '@/components/ui';
import { skills, subjects, trophyCatalog } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { subjectTint } from '@/theme/subjectTheme';
import { space } from '@/theme/tokens';

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
  const ahead = rows.filter((r) => r.you > r.them).map((r) => r.name);
  const behind = rows.filter((r) => r.them > r.you).map((r) => r.name);
  const isYou = them.relation === 'you';

  return (
    <Screen header={<IconButton label="Back" icon="back" onPress={back} />}>
      <Row gap={space.lg}>
        <Avatar username={them.username} size={72} />
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
            <>
              <Caption>
                {[ahead.length ? `You’re ahead in ${ahead.join(', ')}.` : '', behind.length ? `They’re ahead in ${behind.join(', ')}.` : ''].filter(Boolean).join(' ') || 'Neck and neck.'}
              </Caption>
              <Card variant="plain" style={{ gap: space.md }}>
                {rows.map((r) => {
                  const top = Math.max(r.you, r.them, 1);
                  const tint = subjectTint(r.subjectId);
                  return (
                    <View key={r.subjectId} style={{ gap: space.xs }} accessible accessibilityLabel={`${r.name}: you ${r.you} levels, them ${r.them}`}>
                      <Row>
                        <Body style={{ flex: 1 }}>{r.name}</Body>
                        <Caption>{r.you > r.them ? 'You lead' : r.them > r.you ? 'They lead' : 'Tied'}</Caption>
                      </Row>
                      <Row gap={space.sm}>
                        <Caption style={{ width: 44 }}>You</Caption>
                        <View style={{ flex: 1 }}>
                          <ProgressBar value={r.you / top} size="sm" />
                        </View>
                        <Caption style={{ width: 32, textAlign: 'right' }}>{String(r.you)}</Caption>
                      </Row>
                      <Row gap={space.sm}>
                        <Caption style={{ width: 44 }}>Them</Caption>
                        <View style={{ flex: 1 }}>
                          <ProgressBar value={r.them / top} size="sm" fill={tint.base} />
                        </View>
                        <Caption style={{ width: 32, textAlign: 'right' }}>{String(r.them)}</Caption>
                      </Row>
                    </View>
                  );
                })}
              </Card>
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
