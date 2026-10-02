import { trophyInfo, type BrainpowerAwardKind, type DailyAllowance } from '@brainscroll/core';
import { View } from 'react-native';
import { Body, Caption, Card, Eyebrow, Row } from '@/components/ui';
import { trophyCatalog } from '@/content';
import { space } from '@/theme/tokens';

const LINE: Record<BrainpowerAwardKind, { emoji: string; text: string }> = {
  streak: { emoji: '🔥', text: 'You showed up again' },
  trophy: { emoji: '🏆', text: 'Trophy unlocked' },
  chapter_review: { emoji: '📚', text: 'Chapter review complete' },
  perfect: { emoji: '✨', text: 'Lucky Brainpower Drop' },
};

/**
 * The Brainpower an action earned: one line per +1 (streak, trophy, chapter
 * review, the perfect drop), then the balance. Anything earned at the cap
 * isn't kept, so it says "Brainpower Full" instead. Nothing on Unlimited.
 */
export function BrainpowerEarned({ daily }: { daily: DailyAllowance }) {
  if (daily.unlimited || daily.brainpower === null) return null;
  const earned = daily.brainpowerEarned ?? [];
  const granted = earned.filter((e) => e.granted === 1);
  const full = earned.some((e) => e.granted === 0);
  if (earned.length === 0) return null;
  return (
    <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }}>
      <Eyebrow tone="brand">Brainpower</Eyebrow>
      {granted.map((e) => {
        const trophy = e.kind === 'trophy' ? trophyInfo(e.key.slice('trophy:'.length), trophyCatalog)?.name : undefined;
        return (
          <Row key={e.key} gap={space.sm}>
            <Body style={{ flex: 1 }}>
              {LINE[e.kind].emoji} {trophy ? `${LINE[e.kind].text}: ${trophy}` : LINE[e.kind].text}
            </Body>
            <Body>+1</Body>
          </Row>
        );
      })}
      <View>
        <Caption>{full && daily.brainpower >= daily.brainpowerMax ? `Brainpower Full · 🧠 ${daily.brainpower} / ${daily.brainpowerMax}` : `🧠 ${daily.brainpower} / ${daily.brainpowerMax}`}</Caption>
      </View>
    </Card>
  );
}
