import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { IMFellEnglish_400Regular } from '@expo-google-fonts/im-fell-english/400Regular';
import { IMFellEnglish_400Regular_Italic } from '@expo-google-fonts/im-fell-english/400Regular_Italic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from '../ui/theme';

export default function RootLayout() {
  // The map's lettering (bundled, so it works offline; only the cuts the map uses, imported one by one so the
  // other weights stay out of the app). Local files load in a moment; if they fail, the map falls back to the
  // system serif rather than waiting.
  const [loaded, error] = useFonts({ Cinzel_600SemiBold, Cinzel_700Bold, IMFellEnglish_400Regular, IMFellEnglish_400Regular_Italic });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.chrome }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {loaded || error ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.chrome }, animation: 'fade' }} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
