import { SOCIAL_ERROR_TEXT, SocialError, usernameProblem, type SocialCard, type SocialView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import { Avatar, inviteLink } from '@/components/social';
import { Body, Button, Caption, Card, Eyebrow, Field, IconButton, Notice, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Adding friends (owner, 2026-10-01: invite link and username at launch;
 * contacts can come later). Share your invite link anywhere: whoever opens it
 * becomes your friend. Or search an exact username, or enter someone's code.
 * Your own username lives here too.
 */
export default function AddFriendsScreen() {
  const p = useProgress();
  const { social } = p;
  const [view, setView] = useState<SocialView | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<SocialCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      social.view().then(
        (v) => {
          setView(v);
          setName(v.me.username);
        },
        () => setMessage('Couldn’t load your friends. Check your connection.'),
      );
    }, [social]),
  );

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
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    const problem = usernameProblem(name);
    if (problem) return setNameMessage(problem);
    try {
      const saved = await social.setUsername(name);
      setName(saved);
      setNameMessage('Saved.');
      setView((v) => (v ? { ...v, me: { ...v.me, username: saved } } : v));
    } catch (e) {
      setNameMessage(errorText(e));
    }
  };

  const invite = () => {
    if (!view) return;
    void Share.share({
      message: `Learn with me on BrainScroll! I'm @${view.me.username}. Tap to be friends: ${inviteLink(view.me.inviteCode)} (or enter my code ${view.me.inviteCode} in Social).`,
    }).catch(() => {});
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
              <Button compact label="Share invite" onPress={invite} />
            </Row>
          </Card>

          <Card variant="plain" style={{ gap: space.md }}>
            <Field label="Find by username or code" value={query} onChangeText={setQuery} placeholder="@username or code" maxLength={21} />
            <Button label="Find" variant="secondary" loading={busy} onPress={() => void search()} />
            {found && (
              <Row gap={space.md}>
                <Avatar username={found.username} />
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
                  <Avatar username={o.username} size={32} />
                  <Body style={{ flex: 1 }}>{`@${o.username}`}</Body>
                  <Button compact variant="ghost" label="Cancel" onPress={() => void social.removeFriend(o.id).then(() => social.view().then(setView))} />
                </Row>
              ))}
            </View>
          )}

          <Card variant="plain" style={{ gap: space.md }}>
            <Field label="Your username" value={name} onChangeText={(t) => setName(t.toLowerCase())} maxLength={20} />
            <Caption>Friends and league mates see this.</Caption>
            <Button label="Save username" variant="secondary" disabled={name === view.me.username} onPress={() => void saveName()} />
            {nameMessage && <Notice tone="text">{nameMessage}</Notice>}
          </Card>
        </>
      )}
    </Screen>
  );
}
