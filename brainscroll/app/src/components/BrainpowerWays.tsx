import { View } from 'react-native';
import { Body, Caption, Row, UiArt } from '@/components/ui';
import type { UiArtName } from '@/components/ui/uiArt';
import { iconSize, space } from '@/theme/tokens';

/** The ways to earn Brainpower, each with its art (Brainpower screen, out-of-Brainpower screen, Level Complete). */
export const BRAINPOWER_WAYS: { kind: 'streak' | 'trophy' | 'chapter_review' | 'perfect' | 'quest'; art: UiArtName; text: string; note: string }[] = [
  { kind: 'streak', art: 'streak-flame', text: 'Keep your streak going', note: '+1 each day, from day 2' },
  { kind: 'trophy', art: 'trophy', text: 'Win a trophy', note: '+1 for every one' },
  { kind: 'chapter_review', art: 'review', text: 'Finish a chapter review', note: '+1 the first time per chapter' },
  { kind: 'quest', art: 'medal', text: 'Work on a Weekly Quest', note: '+1 for each goal, +1 for finishing' },
  { kind: 'perfect', art: 'lucky-drop', text: 'Get a level perfect', note: 'sometimes drops +1' },
];

/**
 * `compact`: one short line per way, without the notes (the out-of-Brainpower
 * screen, where Unlimited leads). It was a row of five icons with a word each
 * until a phone's larger text broke the words mid-way ("Trophi es"; owner,
 * 2026-10-09).
 */
export function BrainpowerWays({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <View style={{ gap: space.sm }}>
        {BRAINPOWER_WAYS.map((w) => (
          <Row key={w.kind} gap={space.sm}>
            <UiArt name={w.art} size={iconSize.lg} />
            <Body style={{ flex: 1 }}>{w.text}</Body>
          </Row>
        ))}
      </View>
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
