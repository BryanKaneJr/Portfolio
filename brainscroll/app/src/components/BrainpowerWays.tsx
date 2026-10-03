import { View } from 'react-native';
import { Body, Caption, Row, UiArt } from '@/components/ui';
import type { UiArtName } from '@/components/ui/uiArt';
import { iconSize, space } from '@/theme/tokens';

/** The ways to earn Brainpower, each with its art (Brainpower screen, out-of-Brainpower screen, Level Complete). */
export const BRAINPOWER_WAYS: { kind: 'streak' | 'trophy' | 'chapter_review' | 'perfect'; art: UiArtName; text: string; note: string; short: string }[] = [
  { kind: 'streak', art: 'streak-flame', text: 'Keep your streak going', note: '+1 each day, from day 2', short: 'Streak' },
  { kind: 'trophy', art: 'trophy', text: 'Win a trophy', note: '+1 for every one', short: 'Trophies' },
  { kind: 'chapter_review', art: 'review', text: 'Finish a chapter review', note: '+1 the first time per chapter', short: 'Chapter reviews' },
  { kind: 'perfect', art: 'lucky-drop', text: 'Get a level perfect', note: 'sometimes drops +1', short: 'Perfect levels' },
];

/** `compact`: one row of small icons with a word each (the out-of-Brainpower screen, where Unlimited leads). */
export function BrainpowerWays({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <Row style={{ justifyContent: 'space-between' }}>
        {BRAINPOWER_WAYS.map((w) => (
          <View key={w.kind} style={{ flex: 1, alignItems: 'center', gap: space.xxs }}>
            <UiArt name={w.art} size={iconSize.lg} />
            <Caption center>{w.short}</Caption>
          </View>
        ))}
      </Row>
    );
  return (
    <View style={{ gap: space.md }}>
      {BRAINPOWER_WAYS.map((w) => (
        <Row key={w.kind} gap={space.sm}>
          <UiArt name={w.art} size={iconSize.xl} />
          <View style={{ flex: 1 }}>
            <Body>{w.text}</Body>
            <Caption>{w.note}</Caption>
          </View>
        </Row>
      ))}
    </View>
  );
}
