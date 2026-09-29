import { trophyInfo, trophyShareText, type Trophy } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { ShareCard } from '@/components/ShareCard';
import { Button, Caption, Eyebrow, Notice } from '@/components/ui';
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
 * Share a trophy: the card as it will be sent, then the system share sheet.
 * Opened only from trophies the learner holds (the "Trophy earned" card,
 * the Trophies screen, a quest's finish). Nothing leaves the phone unless
 * they choose to send it.
 */
export default function ShareTrophyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trophy = id ? trophyById(id) : undefined;
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | 'failed' | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  if (!trophy) return null;
  const line = trophyShareText(trophy, trophyCatalog);

  const share = () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    shareCard(cardRef, line)
      .then((r) => {
        setOutcome(r);
        if (r !== 'cancelled') track('trophy_shared', { trophy_id: trophy.trophyId, kind: trophy.kind });
      })
      .catch(() => setOutcome('failed'))
      .finally(() => setBusy(false));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: layout.gutter, gap: space.xl }}>
        <Eyebrow tone="brand">Share your trophy</Eyebrow>
        <ShareCard ref={cardRef} trophy={trophy} line={line} />
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
