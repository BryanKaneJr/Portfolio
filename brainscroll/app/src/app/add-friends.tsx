import { SOCIAL_ERROR_TEXT, SocialError, type SocialCard, type SocialView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Avatar, inviteLink } from '@/components/social';
import { Body, Button, Caption, Card, Eyebrow, Field, IconButton, Notice, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Adding friends (owner, 2026-10-01: invite link and username at launch;
 * contacts can come later). Share your invite link anywhere: whoever opens it
 * becomes your friend. Or search an exact username, or enter someone's code.
 * Your own username and avatar live in Edit profile. The link is shown too;
 * where there's no share sheet (a desktop browser), Share copies it instead.
 */
export default function AddFriendsScreen() {
  const p = useProgress();
  const { social } = p;
  const [view, setView] = useState<SocialView | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<SocialCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  // Requests you've sent show under "Waiting for them" as soon as they're sent.
  const refresh = useCallback(() => {
    social.view().then(
      (v) => setView(v),
      () => setMessage('Couldn’t load your friends. Check your connection.'),
    );
  }, [social]);
  useFocusEffect(refresh);

  const errorText = (e: unknown) => (e instanceof SocialError ? SOCIAL_ERROR_TEXT[e.code] : 'That didn’t work. Try again.');

  const search = async () => {
    const q = query.trim().replace(/^@/, '');
    if (!q) return;
    setBusy(true);
    setFound(null);
    setMessage(null);
    try {
      const user = await social.findUser(q);
      if (user) setFound(user);
      else if (/^[A-Za-z0-9]{8}$/.test(q)) {
        // Not a username: maybe someone's invite code.
        const friend = await social.acceptInvite(q);
        setMessage(`You and @${friend.username} are friends now.`);
        setQuery('');
      } else setMessage(SOCIAL_ERROR_TEXT.USER_NOT_FOUND);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async (user: SocialCard) => {
    setBusy(true);
    try {
      const r = await social.sendFriendRequest(user.id);
      setMessage(r === 'friends' ? `You and @${user.username} are friends now.` : `Request sent to @${user.username}.`);
      setFound(null);
      setQuery('');
      refresh();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!view) return;
    const link = inviteLink(view.me.inviteCode);
    setShared(null);
    // A desktop browser has no share sheet: copy the link instead, and say so.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      try {
        await navigator.clipboard.writeText(link);
        setShared('Link copied. Paste it anywhere to invite a friend.');
      } catch {
        setShared('Copy the link above and send it to a friend.');
      }
      return;
    }
    const hello = `Learn with me on BrainScroll! I'm @${view.me.username}.`;
    const code = `(or enter my code ${view.me.inviteCode} in Social)`;
    // iOS: the link goes as a link, so the share sheet and Messages show the invite page's icon, title and
    // picture instead of a plain text bubble (owner, 2026-10-09). Android's sheet takes text only.
    await (Platform.OS === 'ios'
      ? Share.share({ message: `${hello} Tap the link to be friends ${code}.`, url: link })
      : Share.share({ message: `${hello} Tap to be friends: ${link} ${code}.` })
    ).catch(() => {});
  };

  return (
    <Screen
      header={
        <Row gap={space.sm}>
          <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/social'))} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow>Social</Eyebrow>
            <Title>Add friends</Title>
          </View>
        </Row>
      }>
      {!view ? (
        <SkeletonCard lines={3} action />
      ) : (
        <>
          <Card variant="reward" style={{ gap: space.md }}>
            <Title>Invite friends</Title>
            <Caption>Send your link anywhere. Whoever opens it becomes your friend.</Caption>
            <Row gap={space.md}>
              <View style={{ flex: 1 }}>
                <Eyebrow>Your code</Eyebrow>
                <Body>{view.me.inviteCode}</Body>
              </View>
              <Button compact label="Share invite" onPress={() => void invite()} />
            </Row>
            <View style={{ gap: space.xxs }}>
              <Eyebrow>Your link</Eyebrow>
              <Caption>{inviteLink(view.me.inviteCode)}</Caption>
            </View>
            {shared && <Notice tone="text">{shared}</Notice>}
          </Card>

          <Card variant="plain" style={{ gap: space.md }}>
            <Field label="Find by username or code" value={query} onChangeText={setQuery} placeholder="@username or code" maxLength={21} />
            <Button label="Find" variant="secondary" loading={busy} onPress={() => void search()} />
            {found && (
              <Row gap={space.md}>
                <Avatar username={found.username} avatar={found.avatar} />
                <View style={{ flex: 1 }}>
                  <Body numberOfLines={1}>{`@${found.username}`}</Body>
                  <Caption>{`Brain Lv. ${found.knowledgeLevel}`}</Caption>
                </View>
                <Button compact label="Add" loading={busy} onPress={() => void add(found)} />
              </Row>
            )}
            {message && <Notice tone="text">{message}</Notice>}
          </Card>

          {view.outgoing.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Eyebrow>Waiting for them</Eyebrow>
              {view.outgoing.map((o) => (
                <Row key={o.id} gap={space.md}>
                  <Avatar username={o.username} avatar={o.avatar} size={32} />
                  <Body style={{ flex: 1 }}>{`@${o.username}`}</Body>
                  <Button compact variant="ghost" label="Cancel" onPress={() => void social.removeFriend(o.id).then(refresh, () => setMessage('That didn’t work. Try again.'))} />
                </Row>
              ))}
            </View>
          )}

        </>
      )}
    </Screen>
  );
}
