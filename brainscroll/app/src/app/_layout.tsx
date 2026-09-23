import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { ProgressProvider } from '@/progress/ProgressProvider';
import { color } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.bg, primary: color.brand, text: color.text, border: color.border },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="level/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="level-complete" options={{ gestureEnabled: false }} />
          <Stack.Screen name="daily-complete" options={{ presentation: 'modal' }} />
          <Stack.Screen name="review-session" options={{ gestureEnabled: false }} />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        </Stack>
      </ProgressProvider>
    </ThemeProvider>
  );
}
