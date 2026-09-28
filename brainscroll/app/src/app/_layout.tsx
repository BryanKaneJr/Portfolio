import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { DarkTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { BrandSplash } from '@/components/BrandSplash';
import { ProgressProvider, useProgress } from '@/progress/ProgressProvider';
import { useReduceMotion } from '@/theme/feedback';
import { color } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.bg, primary: color.brand, text: color.text, border: color.border },
};

/**
 * Accounts come first. Signed out, every route leads to the sign-in screen;
 * signed in, the sign-in screen leads home (and Home sends new learners to
 * onboarding). There is no guest path around it.
 */
function AuthGate() {
  const { ready, account } = useProgress();
  const onSignIn = useSegments()[0] === 'sign-in';
  useEffect(() => {
    if (!ready || !account) return;
    if (account.status === 'signed_out' && !onSignIn) router.replace('/sign-in');
    else if (account.status === 'signed_in' && onSignIn) router.replace('/');
  }, [ready, account, onSignIn]);
  return null;
}

/** The plum launch screen, until the app knows who's signed in and the font has loaded. */
function LaunchSplash({ fontsReady }: { fontsReady: boolean }) {
  const { ready, account } = useProgress();
  return <BrandSplash done={ready && !!account && fontsReady} />;
}

export default function RootLayout() {
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const reduce = useReduceMotion();
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <AuthGate />
        {/* Reduce Motion turns every push, sheet and slide into a fade. */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: reduce ? 'fade' : 'default' }}>
          <Stack.Screen name="(tabs)" />
          {/* Spatial transitions (roadmap §14): a lesson rises into focus, its result
              settles in place over it, and Reduce Motion turns both into fades. */}
          <Stack.Screen name="level/[id]" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="level-complete" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="daily-complete" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="unlimited" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="review-session" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="sign-in" options={{ gestureEnabled: false, animation: 'fade' }} />
        </Stack>
        <LaunchSplash fontsReady={fontsLoaded || !!fontError} />
      </ProgressProvider>
    </ThemeProvider>
  );
}
