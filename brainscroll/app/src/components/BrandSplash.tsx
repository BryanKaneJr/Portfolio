import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { color } from '@/theme/tokens';

/**
 * The launch screen: the BrainScroll wordmark over crowned Dr. Scroll, on
 * plum (owner, 2026-10-03). One picture (1024 × 1260, transparent) is both
 * the native splash (assets/images/splash-brand.png, which app.json →
 * expo-splash-screen needs as a PNG, 300 wide) and this screen at the same
 * size (splash-brand.webp: the same art at a fifth of the bytes, so it draws
 * sooner), and the native splash stays up until this one's image has drawn:
 * no moment of plum without Dr. Scroll. _layout.tsx calls
 * SplashScreen.preventAutoHideAsync().
 */
const art = require('../../assets/images/splash-brand.webp');
const WIDTH = 300;
const HEIGHT = Math.round((WIDTH * 1260) / 1024);

/** How long the art stays up once it's drawn, so the launch never flickers past. */
export const SPLASH_MIN_MS = 600;
/** Longest the splash waits for its art once the app is ready. */
const SPLASH_MAX_WAIT_MS = 1500;

/** Hands over from the native splash, once (safe to call again). */
const handOver = () => {
  try {
    SplashScreen.hide();
  } catch {
    // Already hidden, or no native splash here (web).
  }
};

/**
 * Shows the splash until `done` is true AND the art has been on screen for
 * SPLASH_MIN_MS. It never hides before its own art has loaded.
 */
export function BrandSplash({ done }: { done: boolean }) {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [held, setHeld] = useState(true);

  // Safety nets: never hang on either splash, even if the art fails to load.
  useEffect(() => {
    const t = setTimeout(handOver, SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      handOver();
      setHeld(false);
    }, SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (!done || shownAt === null) return;
    const t = setTimeout(() => setHeld(false), Math.max(0, SPLASH_MIN_MS - (Date.now() - shownAt)));
    return () => clearTimeout(t);
  }, [done, shownAt]);

  if (!held) return null;
  return (
    <View style={styles.screen} accessible accessibilityLabel="BrainScroll is loading" accessibilityRole="progressbar" aria-busy>
      <Image
        source={art}
        style={styles.art}
        resizeMode="contain"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
        onLoadEnd={() => {
          setShownAt((t) => t ?? Date.now());
          // The art is drawn: now the native splash can go, with nothing to see change.
          requestAnimationFrame(handOver);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: color.plumDeep, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  // Matches the native splash (app.json imageWidth 300), so the hand-off doesn't jump.
  art: { width: WIDTH, height: HEIGHT },
});
