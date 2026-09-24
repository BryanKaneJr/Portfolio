import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { color } from '@/theme/tokens';

/**
 * The launch screen: Dr. Scroll's minimalist mark (bald crown, white hair
 * tufts, round glasses) on plum, with the wordmark at the bottom. It matches the
 * native splash (app.json → expo-splash-screen) so the hand-off is seamless.
 *
 * To swap the art, replace assets/images/splash-mark.png (1024 × 1024,
 * transparent). The native splash uses the same file.
 */
const mark = require('../../assets/images/splash-mark.png');

/** How long the mark stays up once it's drawn, so the launch never flickers past. */
export const SPLASH_MIN_MS = 600;
/** Longest the splash waits for its art once the app is ready. */
const SPLASH_MAX_WAIT_MS = 1500;

/**
 * Shows the splash until `done` is true AND the mark has been on screen for
 * SPLASH_MIN_MS. It never hides before its own art has loaded.
 */
export function BrandSplash({ done }: { done: boolean }) {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [held, setHeld] = useState(true);

  // Safety net: never hang on the splash, even if the art fails to load.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHeld(false), SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (!done || shownAt === null) return;
    const t = setTimeout(() => setHeld(false), Math.max(0, SPLASH_MIN_MS - (Date.now() - shownAt)));
    return () => clearTimeout(t);
  }, [done, shownAt]);

  if (!held) return null;
  return (
    <View style={styles.screen} accessibilityLabel="BrainScroll is loading" accessibilityRole="progressbar">
      <Image
        source={mark}
        style={styles.mark}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        onLoadEnd={() => setShownAt((t) => t ?? Date.now())}
      />
      <Text style={styles.wordmark} accessible={false}>
        brainscroll
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: color.plumDeep, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  mark: { width: 220, height: 220 },
  wordmark: { position: 'absolute', bottom: 64, color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
});
