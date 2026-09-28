import { Pressable, Switch, View } from 'react-native';
import { Body, Caption, Card, Eyebrow } from '@/components/ui';
import { feedback, setFeedbackPref, useFeedbackPrefs, type FeedbackPrefs } from '@/theme/feedback';
import { hasAnySound } from '@/theme/sounds';
import { color, layout, space } from '@/theme/tokens';

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

/**
 * The whole row is the switch: a large target (the platform switch alone is
 * about 31 pt tall), and screen readers hear one "Haptics, switch, on" with
 * its description, not a label and a separate unnamed control.
 */
function Toggle({ label, detail, value, onChange }: { label: string; detail: string; value: FeedbackPrefs[keyof FeedbackPrefs]; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTouch }, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Body>{label}</Body>
        <Caption>{detail}</Caption>
      </View>
      {/* The visible switch; taps and speech go to the row. */}
      <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          trackColor={{ false: color.borderStrong, true: color.brand }}
          thumbColor={color.onBrand}
          ios_backgroundColor={color.borderStrong}
        />
      </View>
    </Pressable>
  );
}
