import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStateProvider, useAppState } from '../state/AppState';
import { dark, light } from '../theme/colors';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, primary: c.accent, border: c.divider },
  };
  // Icons for Android and web, and the dish pictures everywhere (assets/fonts, built by scripts/icons).
  const [fontsLoaded, fontError] = useFonts({
    AppIcons: require('../../assets/fonts/AppIcons.ttf'),
    AppIconsFilled: require('../../assets/fonts/AppIconsFilled.ttf'),
  });

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ReadyGate bg={c.bg} fontsLoaded={fontsLoaded || !!fontError}>
            <Stack
              screenOptions={{
                headerTintColor: c.accent,
                headerTitleStyle: { color: c.text, fontWeight: '600' },
                headerShadowVisible: false,
                headerStyle: { backgroundColor: c.bg },
                contentStyle: { backgroundColor: c.bg },
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Cook With That' }} />
              <Stack.Screen name="results" options={{ title: 'Recipes' }} />
              <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
              <Stack.Screen name="edit" options={{ title: 'Edit recipe', presentation: 'modal' }} />
              <Stack.Screen name="plan-add" options={{ title: 'Add a recipe' }} />
              <Stack.Screen name="pantry-edit" options={{ title: 'Your pantry' }} />
              <Stack.Screen name="selections" options={{ title: 'Your ingredients' }} />
              <Stack.Screen name="staples" options={{ title: 'Kitchen staples' }} />
              <Stack.Screen name="ingredients" options={{ title: 'All ingredients' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            </Stack>
          </ReadyGate>
        </ThemeProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

/**
 * Don't show interactive screens until saved selections/pantry have loaded from
 * the device, so an early tap can't be overwritten by the restore.
 */
function ReadyGate({ children, bg, fontsLoaded }: { children: ReactNode; bg: string; fontsLoaded: boolean }) {
  const { ready } = useAppState();
  return ready && fontsLoaded ? <>{children}</> : <View style={{ flex: 1, backgroundColor: bg }} />;
}
