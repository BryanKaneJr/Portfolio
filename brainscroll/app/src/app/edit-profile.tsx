import { SOCIAL_ERROR_TEXT, SocialError, usernameProblem, type SocialView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/social';
import { Button, Caption, Card, Eyebrow, Field, IconButton, LoadError, Notice, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { questDef, useQuests } from '@/progress/useQuests';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Edit profile (owner, 2026-10-01): the pencil on Profile opens it. Your
 * avatar (everyone starts with a random tree's; the picker has the rest),
 * your username, and the title you wear from a weekly quest.
 */
export default function EditProfileScreen() {
  const p = useProgress();
  const { social } = p;
  const quests = useQuests();
  const [me, setMe] = useState<SocialView['me'] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    social.view().then(
      (v) => {
        setMe(v.me);
        setName(v.me.username);
      },
      () => setFailed(true),
    );
  }, [social]);
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/profile'));

  const saveName = async () => {
    const problem = usernameProblem(name);
    if (problem) return setNameMessage(problem);
    try {
      const saved = await social.setUsername(name);
      setName(saved);
      setMe((m) => (m ? { ...m, username: saved } : m));
      setNameMessage('Saved.');
    } catch (e) {
      setNameMessage(e instanceof SocialError ? SOCIAL_ERROR_TEXT[e.code] : 'That didn’t work. Try again.');
    }
  };

  const data = quests.data;
  // Titles come with quest trophies (live-week clears), as on the Trophies screen.
  const titles = (data?.trophies ?? []).flatMap((t) => (t.kind === 'quest' && t.questId && questDef(t.questId)?.titleReward ? [questDef(t.questId)!] : []));
  const wearTitle = (titleQuestId: string | null) => {
    if (!data) return;
    setTitleError(null);
    p.setEquipped({ ...data.equipped, titleQuestId }).then(
      () => void quests.reload(),
      () => setTitleError('Couldn’t change that. Try again.'),
    );
  };

  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={back} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>Profile</Eyebrow>
        <Title>Edit profile</Title>
      </View>
    </Row>
  );
  if (failed) return <LoadError layout="screen" onRetry={load} onBack={back} />;
  if (!me)
    return (
      <Screen header={header}>
        <SkeletonCard lines={3} action />
      </Screen>
    );

  return (
    <Screen header={header}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Your avatar. Change it" onPress={() => router.push('/avatar')} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Avatar username={me.username} avatar={me.avatar} size={144} />
        </Pressable>
        <Button compact variant="secondary" label="Change avatar" onPress={() => router.push('/avatar')} />
      </View>

      <Card variant="plain" style={{ gap: space.md }}>
        <Field label="Username" value={name} onChangeText={(t) => setName(t.toLowerCase())} maxLength={20} />
        <Caption>Friends and league mates see this.</Caption>
        <Button label="Save username" variant="secondary" disabled={name === me.username} onPress={() => void saveName()} />
        {nameMessage && <Notice tone="text">{nameMessage}</Notice>}
      </Card>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Title</Eyebrow>
        {titles.length === 0 ? (
          <Caption>Finish a weekly quest in its week to earn a title. It shows under your name.</Caption>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <Button compact variant="secondary" label="None" selected={data?.equipped.titleQuestId === null} onPress={() => wearTitle(null)} />
            {titles.map((q) => (
              <Button key={q.id} compact variant="secondary" label={q.titleReward} selected={data?.equipped.titleQuestId === q.id} onPress={() => wearTitle(q.id)} />
            ))}
          </View>
        )}
        {titleError && <Notice>{titleError}</Notice>}
      </View>
    </Screen>
  );
}
