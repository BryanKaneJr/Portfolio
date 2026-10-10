// One import per weight: the package's index brings in all 16 font files, and an instant update carries at most 1,000 files.
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { DarkTheme, router, Stack, ThemeProvider, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { BrandSplash } from '@/components/BrandSplash';
import { PushSync } from '@/components/PushSync';
import { ReminderSync } from '@/components/ReminderSettings';
// First, so its popstate listener runs before the router's (web; see popGuard).
import '@/navigation/popGuard';
import { initCrashReporting, withCrashReporting } from '@/observability/crash';
import { ProgressProvider, useProgress } from '@/progress/ProgressProvider';
import { holdInviteFrom, takePendingInvite } from '@/social/pendingInvite';
import { useReduceMotion } from '@/theme/feedback';
import { color } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

// Keep the native splash up until BrandSplash has drawn its art (it hides it then).
void SplashScreen.preventAutoHideAsync().catch(() => {});

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
 * onboarding). There is no guest path around it. An invite link opened while
 * signed out is held through sign-in and opened right after it.
 */
function AuthGate() {
  const { ready, account } = useProgress();
  const onSignIn = useSegments()[0] === 'sign-in';
  const path = usePathname();
  useEffect(() => {
    if (!ready || !account) return;
    if (account.status === 'signed_out' && !onSignIn) {
      holdInviteFrom(path);
      router.replace('/sign-in');
    } else if (account.status === 'signed_in' && onSignIn) {
      const invite = takePendingInvite();
      router.replace(invite ? { pathname: '/invite/[code]', params: { code: invite } } : '/');
    }
  }, [ready, account, onSignIn, path]);
  return null;
}

/** The plum launch screen, until the app knows who's signed in and the font has loaded. */
function LaunchSplash({ fontsReady }: { fontsReady: boolean }) {
  const { ready, account } = useProgress();
  return <BrandSplash done={ready && !!account && fontsReady} />;
}

initCrashReporting();

function RootLayout() {
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const reduce = useReduceMotion();
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <AuthGate />
        <ReminderSync />
        <PushSync />
        {/* Reduce Motion turns every push, sheet and slide into a fade. Screens
            out of sight freeze (no re-renders) until they're back in view. */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: reduce ? 'fade' : 'default', freezeOnBlur: true }}>
          <Stack.Screen name="(tabs)" />
          {/* Spatial transitions (roadmap §14): a lesson rises into focus, its result
              settles in place over it, and Reduce Motion turns both into fades. */}
          <Stack.Screen name="level/[id]" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="level-complete" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="daily-complete" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="unlimited" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="review-session" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="trophies" options={{ animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="settings" options={{ animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="edit-profile" options={{ animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="streak" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="brainpower" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="chest" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="share/[id]" options={{ presentation: 'modal', animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="final-round/[id]" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="chapter-review" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false, animation: reduce ? 'fade' : 'default' }} />
          <Stack.Screen name="sign-in" options={{ gestureEnabled: false, animation: 'fade' }} />
        </Stack>
        <LaunchSplash fontsReady={fontsLoaded || !!fontError} />
      </ProgressProvider>
    </ThemeProvider>
  );
}

export default withCrashReporting(RootLayout);
