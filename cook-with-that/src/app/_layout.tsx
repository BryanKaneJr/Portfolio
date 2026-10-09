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
    colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, primary: c.primary, border: c.divider },
  };

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ReadyGate bg={c.bg}>
            <Stack
              screenOptions={{
                headerTintColor: c.primary,
                headerTitleStyle: { color: c.text, fontWeight: '700' },
                headerShadowVisible: false,
                headerStyle: { backgroundColor: c.bg },
                contentStyle: { backgroundColor: c.bg },
                headerBackTitle: 'Back',
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false, title: 'Find recipes' }} />
              <Stack.Screen name="results" options={{ title: 'Recipes' }} />
              <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
              <Stack.Screen name="favorites" options={{ title: 'Favorites' }} />
              <Stack.Screen name="pantry" options={{ title: 'My pantry' }} />
              <Stack.Screen name="pantry-results" options={{ title: 'From your pantry' }} />
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
function ReadyGate({ children, bg }: { children: ReactNode; bg: string }) {
  const { ready } = useAppState();
  return ready ? <>{children}</> : <View style={{ flex: 1, backgroundColor: bg }} />;
}
