import { streakShareText, trophyInfo, trophyShareText, type Trophy } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { ShareCard, type ShareSubject } from '@/components/ShareCard';
import { useProgressView } from '@/progress/ProgressProvider';
import { useQuests } from '@/progress/useQuests';
import { Button, Caption, Eyebrow, LoadError, Notice, StateBlock } from '@/components/ui';
import { quests, trophyCatalog } from '@/content';
import { shareCard, type ShareOutcome } from '@/share/shareCard';
import { color, layout, space } from '@/theme/tokens';

/** A trophy's name, kind and quest from its id alone (quest trophies from content, the rest from core). */
function trophyById(id: string): Pick<Trophy, 'trophyId' | 'name' | 'kind' | 'questId'> | undefined {
  const quest = quests.find((q) => q.trophy.id === id);
  if (quest) return { trophyId: id, name: quest.trophy.name, kind: 'quest', questId: quest.id };
  const info = trophyInfo(id, trophyCatalog);
  return info ? { trophyId: id, name: info.name, kind: info.kind } : undefined;
}

/**
 * Share a trophy (or the current streak, id `streak`): the card as it will
 * be sent, then the system share sheet.
 * Opened from trophies the learner holds (the "Trophy earned" card, the
 * Trophies screen, Profile, a quest's finish), and checked against their
 * shelf, so a deep link can't make a card for a trophy they don't have. Nothing leaves the phone unless
 * they choose to send it.
 */
export default function ShareTrophyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { streak } = useProgressView();
  const shelf = useQuests();
  // `streak` shares the current learning streak (from the streak screen); anything else is a trophy id,
  // and only one the learner holds (a deep link to someone else's trophy shows nothing).
  const held = id !== 'streak' && !!shelf.data?.trophies.some((t) => t.trophyId === id);
  const trophy = id && id !== 'streak' && held ? trophyById(id) : undefined;
  const subject: ShareSubject | undefined = id === 'streak' ? (streak.current > 0 ? { streakDays: streak.current } : undefined) : trophy ? { trophy } : undefined;
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | 'failed' | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  if (id !== 'streak' && shelf.failed) return <LoadError layout="screen" onRetry={() => void shelf.reload()} onBack={close} />;
  // Still checking the shelf: nothing yet (a moment at most).
  if (!subject && id !== 'streak' && !shelf.data) return null;
  if (!subject)
    return (
      <StateBlock
        layout="screen"
        spot="not-found"
        art="empty-box"
        title="Nothing to share yet."
        body={id === 'streak' ? 'Learn something today to start a streak.' : 'This trophy isn’t on your shelf yet.'}
        secondary={{ label: 'Close', onPress: close }}
      />
    );
  const line = 'trophy' in subject ? trophyShareText(subject.trophy, trophyCatalog) : streakShareText(subject.streakDays);
  const what = 'trophy' in subject ? { trophy_id: subject.trophy.trophyId, kind: subject.trophy.kind } : { trophy_id: 'streak', kind: 'streak' };

  const share = () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    shareCard(cardRef, line)
      .then((r) => {
        setOutcome(r);
        if (r !== 'cancelled') track('trophy_shared', what);
      })
      .catch(() => setOutcome('failed'))
      .finally(() => setBusy(false));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: layout.gutter, gap: space.xl }}>
        <Eyebrow tone="brand">{'trophy' in subject ? 'Share your trophy' : 'Share your streak'}</Eyebrow>
        <ShareCard ref={cardRef} subject={subject} line={line} />
        {outcome === 'copied' && <Caption center>Copied. Paste it anywhere.</Caption>}
        {outcome === 'failed' && <Notice>Couldn’t open sharing. Try again.</Notice>}
      </ScrollView>
      <View style={{ padding: layout.gutter, gap: space.sm }}>
        <Button label={busy ? 'Opening' : 'Share'} loading={busy} onPress={share} />
        <Button variant="ghost" label="Close" onPress={close} />
      </View>
    </SafeAreaView>
  );
}
