import { View } from 'react-native';
import { Body, Caption, Row, UiArt } from '@/components/ui';
import type { UiArtName } from '@/components/ui/uiArt';
import { iconSize, space } from '@/theme/tokens';

/** The ways to earn Brainpower, each with its art (Brainpower screen, out-of-Brainpower screen, Level Complete). */
export const BRAINPOWER_WAYS: { kind: 'streak' | 'trophy' | 'chapter_review' | 'perfect'; art: UiArtName; text: string; note: string }[] = [
  { kind: 'streak', art: 'streak-flame', text: 'Keep your streak going', note: '+1 each day, from day 2' },
  { kind: 'trophy', art: 'trophy', text: 'Win a trophy', note: '+1 for every one' },
  { kind: 'chapter_review', art: 'review', text: 'Finish a chapter review', note: '+1 the first time per chapter' },
  { kind: 'perfect', art: 'lucky-drop', text: 'Get a level perfect', note: 'sometimes drops +1' },
];

export function BrainpowerWays() {
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
