import { DarkTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ProgressProvider, useProgress } from '@/progress/ProgressProvider';
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

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <AuthGate />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="level/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="level-complete" options={{ gestureEnabled: false }} />
          <Stack.Screen name="daily-complete" options={{ presentation: 'modal' }} />
          <Stack.Screen name="review-session" options={{ gestureEnabled: false }} />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          <Stack.Screen name="sign-in" options={{ gestureEnabled: false, animation: 'fade' }} />
        </Stack>
      </ProgressProvider>
    </ThemeProvider>
  );
}
