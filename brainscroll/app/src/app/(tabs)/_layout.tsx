import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, fw } from '@/theme/tokens';

type IconName = SymbolViewProps['name'];

function icon(name: IconName) {
  return function TabIcon({ color: tint }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={tint} size={26} />;
  };
}

/**
 * Four destinations for V1 (visual direction §3). Learning launches from Home or
 * a skill, and the tab bar disappears inside lessons (they're stack screens).
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border, height: 64 + insets.bottom, paddingTop: space.sm },
        tabBarLabelStyle: { fontSize: 11, ...fw('700'), letterSpacing: 0.4 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon({ ios: 'house.fill', android: 'home', web: 'home' }) }} />
      <Tabs.Screen name="skills" options={{ title: 'Skills', tabBarIcon: icon({ ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' }) }} />
      <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: icon({ ios: 'arrow.triangle.2.circlepath', android: 'refresh', web: 'refresh' }) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon({ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }) }} />
    </Tabs>
  );
}
