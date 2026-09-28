import { Switch, View } from 'react-native';
import { Body, Caption, Card, Eyebrow, Row } from '@/components/ui';
import { feedback, setFeedbackPref, useFeedbackPrefs, type FeedbackPrefs } from '@/theme/feedback';
import { hasAnySound } from '@/theme/sounds';
import { color, space } from '@/theme/tokens';

/**
 * Sound and haptics, each one tap away (roadmap §14). The app makes complete
 * sense with both off; they only add feel. Sound also follows the silent switch.
 */
export function FeedbackSettings() {
  const prefs = useFeedbackPrefs();
  const soundReady = hasAnySound();
  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow>Feel</Eyebrow>
      <Toggle
        label="Sound effects"
        detail={soundReady ? 'Short sounds for answers and milestones. Follows your silent switch.' : 'Sound effects arrive in an update.'}
        value={prefs.sound}
        onChange={(v) => setFeedbackPref('sound', v)}
      />
      <Toggle
        label="Haptics"
        detail="Light taps that confirm answers and bigger moments."
        value={prefs.haptics}
        onChange={(v) => {
          setFeedbackPref('haptics', v);
          if (v) feedback('select');
        }}
      />
    </Card>
  );
}

function Toggle({ label, detail, value, onChange }: { label: string; detail: string; value: FeedbackPrefs[keyof FeedbackPrefs]; onChange: (v: boolean) => void }) {
  return (
    <Row gap={space.md} style={{ alignItems: 'center' }}>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Body>{label}</Body>
        <Caption>{detail}</Caption>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: color.surfaceRaised, true: color.brand }}
        thumbColor={color.onBrand}
        ios_backgroundColor={color.surfaceRaised}
      />
    </Row>
  );
}
